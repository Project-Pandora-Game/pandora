import type { Immutable } from 'immer';
import _ from 'lodash';
import type { CharacterAppearance } from '../assets/appearance';
import type { AppearanceActionProcessingContext } from '../assets/appearanceActionProcessingContext';
import { SplitContainerPath } from '../assets/appearanceHelpers';
import type { ActionTarget, ActionTargetCharacter, ItemContainerPath, ItemPath } from '../assets/appearanceTypes';
import { AppearanceItemProperties } from '../assets/appearanceValidation';
import { Asset } from '../assets/asset';
import { EffectsDefinition } from '../assets/effects';
import { FilterItemType, type Item, type ItemId, type RoomDeviceLink } from '../assets/item';
import { AssetPropertiesResult, CreateAssetPropertiesResult } from '../assets/properties';
import { GetRestrictionOverrideConfig, RestrictionOverrideConfig } from '../assets/state/characterStateTypes';
import { HearingImpairment, Muffler } from '../character/speech';
import type { GameLogicCharacter } from '../gameLogic/character/character';
import type { ActionSpaceContext } from '../space/space';
import { Assert, AssertNever } from '../utility';
import { ItemInteractionType, type RestrictionResult } from './restrictionTypes';

/**
 * All functions should return a stable value, or useSyncExternalStore will not work properly.
 */
export class CharacterRestrictionsManager {
	public readonly appearance: CharacterAppearance;
	public readonly spaceContext: ActionSpaceContext;
	public readonly restrictionOverrideConfig: RestrictionOverrideConfig;
	private _items: readonly Item[] = [];
	private _properties: Immutable<AssetPropertiesResult> = CreateAssetPropertiesResult();
	private _roomDeviceLink: Immutable<RoomDeviceLink> | null = null;

	public get character(): GameLogicCharacter {
		return this.appearance.character;
	}

	constructor(appearance: CharacterAppearance, spaceContext: ActionSpaceContext) {
		this.appearance = appearance;
		this.spaceContext = spaceContext;
		this.restrictionOverrideConfig = GetRestrictionOverrideConfig(this.appearance.getRestrictionOverride());
	}

	private updateCachedData(): void {
		const items = this.appearance.getAllItems();
		if (items === this._items)
			return;

		this._items = items;
		this._properties = AppearanceItemProperties(items);

		const roomDeviceWearable = items.find((i) => i.isType('roomDeviceWearablePart'));
		this._roomDeviceLink = roomDeviceWearable?.isType('roomDeviceWearablePart') ? roomDeviceWearable.roomDeviceLink : null;
	}

	public getProperties(): Immutable<AssetPropertiesResult> {
		this.updateCachedData();

		return this._properties;
	}

	public getRoomDeviceLink(): Immutable<RoomDeviceLink> | null {
		this.updateCachedData();

		return this._roomDeviceLink;
	}

	/**
	 * Calculates the properties for items between `from` and `to` (inclusive), excluding `exclude`.
	 */
	public getLimitedProperties({ from, to, exclude }: { from?: ItemId; to?: ItemId; exclude?: ItemId; }): Readonly<AssetPropertiesResult> {
		const items = this.appearance.getAllItems();
		let ignore = !!from;
		const limitedItems: Item[] = [];
		for (const item of items) {
			if (item.id === from) {
				ignore = false;
			}

			if (!ignore && item.id !== exclude) {
				limitedItems.push(item);
			}

			if (item.id === to) {
				break;
			}
		}
		return AppearanceItemProperties(limitedItems);
	}

	/**
	 * @returns Stable result for effects
	 */
	public getEffects(): Readonly<EffectsDefinition> {
		return this.getProperties().effects;
	}

	/**
	 * Returns if this character can use hands
	 */
	public canUseHands(): boolean {
		return !this.getEffects().blockHands;
	}

	/**
	 * Returns the Muffler class for this CharacterRestrictionsManager
	 */
	public getMuffler(): Muffler {
		return new Muffler(this.character.id, this.getEffects());
	}

	/**
	 * Returns the HearingImpairment class for this CharacterRestrictionsManager
	 */
	public getHearingImpairment(): HearingImpairment {
		return new HearingImpairment(this.character.id, this.getEffects());
	}

	/**
	 * Calculates the blind level effect
	 * @returns Strength as number in range [0, 10]
	 */
	public getBlindness(): number {
		return _.clamp(this.getEffects().blind, 0, 10);
	}

	public isInteractionBlocked(): boolean {
		return this.restrictionOverrideConfig.blockInteractions;
	}

	public forceAllowItemActions(): boolean {
		return this.restrictionOverrideConfig.forceAllowItemActions;
	}

	public forceAllowRoomLeave(): boolean {
		return this.restrictionOverrideConfig.forceAllowRoomLeave;
	}

	public isCurrentSpaceAdmin(): boolean {
		if (this.spaceContext.isAdmin(this.character.accountId))
			return true;

		return false;
	}

	public canInteractWithTarget(context: AppearanceActionProcessingContext, target: ActionTargetCharacter | null): RestrictionResult {
		// Non-character inventories can always be interacted with
		if (target == null)
			return { allowed: true };

		// Have all permissions on self
		if (target.character.id === this.character.id)
			return { allowed: true };

		const targetCharacter = target.getRestrictionManager(this.spaceContext);

		// Mark as interaction
		context.addInteraction(target.character, 'interact');

		// Check interaction block (safe mode, timeout)
		if (this.isInteractionBlocked() || targetCharacter.isInteractionBlocked())
			return {
				allowed: false,
				restriction: {
					type: 'safemodeInteractOther',
				},
			};

		return { allowed: true };
	}

	public canUseAsset(context: AppearanceActionProcessingContext, targetCharacter: ActionTargetCharacter | null, asset: Asset): RestrictionResult {
		// Must be able to interact with character
		const r = this.canInteractWithTarget(context, targetCharacter);
		if (!r.allowed)
			return r;

		// Non-character inventories have no other restrictions
		if (targetCharacter == null)
			return { allowed: true };

		// Can do all on self
		if (targetCharacter.character.id === this.character.id)
			return { allowed: true };

		const resolution = targetCharacter.character.assetPreferences.resolveAssetPreference(asset, this.character.id);
		switch (resolution.preference) {
			case 'doNotRender':
			case 'prevent':
				return {
					allowed: false,
					restriction: {
						type: 'missingAssetPermission',
						target: targetCharacter.character.id,
						resolution,
					},
				};
			case 'maybe':
				context.addRequiredPermission(
					targetCharacter.character.assetPreferences.getPreferencePermission('maybe'),
				);
			// Fallthrough
			case 'normal':
				context.addRequiredPermission(
					targetCharacter.character.assetPreferences.getPreferencePermission('normal'),
				);
			// Fallthrough
			case 'favorite':
				context.addRequiredPermission(
					targetCharacter.character.assetPreferences.getPreferencePermission('favorite'),
				);
				break;
			default:
				AssertNever(resolution.preference);
		}

		return { allowed: true };
	}

	public hasPermissionForItemContents(context: AppearanceActionProcessingContext, targetCharacter: ActionTargetCharacter | null, item: Item): RestrictionResult {
		// Permission on the item itself is intentionally not checked

		// Iterate over whole content
		for (const module of item.getModules().keys()) {
			for (const innerItem of item.getModuleItems(module)) {
				// Check the item can be used
				let r = this.canUseAsset(context, targetCharacter, innerItem.asset);
				if (!r.allowed)
					return r;
				// Check its content can be used
				r = this.hasPermissionForItemContents(context, targetCharacter, innerItem);
				if (!r.allowed)
					return r;
			}
		}
		return { allowed: true };
	}

	/**
	 * Validate if this character can use item on target in specific way, supplying the path to the item
	 * @param target - Target on which the item is being interected with
	 * @param itemPath - Path to the item
	 * @param interaction - What kind of interaction to check against
	 * @param insertBeforeRootItem - Simulate the item being positioned before (under) this item. Undefined means that it either is currently present or that it is to be inserted to the end.
	 */
	public canUseItem(context: AppearanceActionProcessingContext, target: ActionTarget, itemPath: ItemPath, interaction: ItemInteractionType, insertBeforeRootItem?: ItemId): RestrictionResult {
		const item = target.getItem(itemPath);
		// The item must exist to interact with it
		if (!item)
			return {
				allowed: false,
				restriction: {
					type: 'invalid',
				},
			};

		return this.canUseItemDirect(context, target, itemPath.container, item, interaction, insertBeforeRootItem);
	}

	/**
	 * Validate if this character can use item on target in specific way, supplying the item itself
	 * @param target - Target on which the item is being interected with
	 * @param container - Container in which the item is
	 * @param item - The item itself, as object
	 * @param interaction - What kind of interaction to check against
	 * @param insertBeforeRootItem - Simulate the item being positioned before (under) this item. Undefined means that it either is currently present or that it is to be inserted to the end.
	 */
	public canUseItemDirect(context: AppearanceActionProcessingContext, target: ActionTarget, container: ItemContainerPath, item: Item, interaction: ItemInteractionType, insertBeforeRootItem?: ItemId): RestrictionResult {

		// Must validate insertBeforeRootItem, if present
		if (insertBeforeRootItem && target.getItem({ container: [], itemId: insertBeforeRootItem }) == null)
			return {
				allowed: false,
				restriction: {
					type: 'invalid',
				},
			};

		const targetCharacter = context.resolveTargetCharacter(target, container);
		Assert(target.type !== 'character' || target === targetCharacter);

		// Must be able to use item's asset
		let r = this.canUseAsset(context, targetCharacter, item.asset);
		if (!r.allowed)
			return r;

		/** If the action should be considered as "manipulating themselves" for the purpose of self-blocking checks */
		const isSelfAction = targetCharacter != null && targetCharacter.character.id === this.character.id;
		const forceAllowItemActions = this.forceAllowItemActions();
		/** Whether the item is physically equipped (on a character, or on some item; in contrast to simply being stored e.g. in a bag) */
		let isPhysicallyEquipped = target.type === 'character';

		// Must be able to access all upper items
		const upperPath = SplitContainerPath(container);
		if (upperPath) {
			const upperItem = target.getItem(upperPath.itemPath);
			const containingModule = upperItem?.getModules().get(upperPath.module);
			if (!containingModule)
				return {
					allowed: false,
					restriction: {
						type: 'invalid',
					},
				};

			isPhysicallyEquipped = containingModule.contentsPhysicallyEquipped;

			r = this.canUseItemModule(
				context,
				target,
				upperPath.itemPath,
				upperPath.module,
				interaction === ItemInteractionType.ACCESS_ONLY ? ItemInteractionType.ACCESS_ONLY : ItemInteractionType.MODIFY,
			);
			if (!r.allowed)
				return r;
		}

		// If access is all we needed, then success
		if (interaction === ItemInteractionType.ACCESS_ONLY)
			return { allowed: true };

		// Bodyparts have different handling (we already checked we can interact with the asset)
		if (item.isType('personal') && item.asset.definition.bodypart != null) {
			// Only characters have bodyparts
			if (target.type !== 'character')
				return {
					allowed: false,
					restriction: {
						type: 'invalid',
					},
				};

			// Not all rooms allow bodypart changes (changing expression is allowed)
			if (
				!this.spaceContext.features.includes('allowBodyChanges') &&
				interaction !== ItemInteractionType.EXPRESSION_CHANGE
			) {
				return {
					allowed: false,
					restriction: {
						type: 'modifyBodyRoom',
					},
				};
			}

			// Bodyparts have special interaction type
			context.addInteraction(target.character, 'modifyBody');

			return { allowed: true };
		}

		// Changing expression makes sense only on bodyparts
		if (interaction === ItemInteractionType.EXPRESSION_CHANGE)
			return {
				allowed: false,
				restriction: {
					type: 'invalid',
				},
			};

		// To add or remove the item, we need to have access to all contained items
		if (interaction === ItemInteractionType.ADD_REMOVE || interaction === ItemInteractionType.DEVICE_ENTER_LEAVE) {
			r = this.hasPermissionForItemContents(context, targetCharacter, item);
			if (!r.allowed)
				return r;
		}

		// Enter/Leave interaction is only allowed on room devices and their wearable parts
		if (interaction === ItemInteractionType.DEVICE_ENTER_LEAVE) {
			if (!item.asset.isType('roomDevice') && !item.asset.isType('roomDeviceWearablePart'))
				return {
					allowed: false,
					restriction: {
						type: 'invalid',
					},
				};
		}

		// Styling the item is a "color"-like interaction
		if (interaction === ItemInteractionType.STYLING) {
			if (targetCharacter != null) {
				context.addInteraction(targetCharacter.character, 'changeItemColor');
			}
		}

		const properties = item.getProperties();

		// If equipping (or entering a device) there are further checks
		if ((interaction === ItemInteractionType.ADD_REMOVE || interaction === ItemInteractionType.DEVICE_ENTER_LEAVE) && isPhysicallyEquipped) {
			// If item blocks add/remove, fail
			if (properties.blockAddRemove && !forceAllowItemActions)
				return {
					allowed: false,
					restriction: {
						type: 'blockedAddRemove',
						asset: item.asset.id,
						itemName: item.name ?? '',
						self: false,
					},
				};

			// If equipping on self, the asset must allow self-equip
			if (isSelfAction && properties.blockSelfAddRemove && !forceAllowItemActions)
				return {
					allowed: false,
					restriction: {
						type: 'blockedAddRemove',
						asset: item.asset.id,
						itemName: item.name ?? '',
						self: true,
					},
				};
		}

		if (isPhysicallyEquipped && !forceAllowItemActions && target.type === 'character') {
			const targetProperties = target.getRestrictionManager(this.spaceContext).getLimitedProperties({
				from: insertBeforeRootItem ?? (container.length > 0 ? container[0].item : item.id),
				exclude: container.length > 0 ? container[0].item : item.id,
			});
			const coveredAttribute = Array.from(properties.attributes).find((a) => targetProperties.attributesCovers.has(a));
			if (coveredAttribute != null) {
				return {
					allowed: false,
					restriction: {
						type: 'covered',
						asset: item.asset.id,
						itemName: item.name ?? '',
						attribute: coveredAttribute,
					},
				};
			}
		}

		// Must be able to use hands (for most interaction types)
		if (
			interaction === ItemInteractionType.STYLING ||
			interaction === ItemInteractionType.MODIFY ||
			interaction === ItemInteractionType.ADD_REMOVE ||
			interaction === ItemInteractionType.REORDER
		) {
			if (!this.canUseHands() && !forceAllowItemActions)
				return {
					allowed: false,
					restriction: {
						type: 'blockedHands',
					},
				};
		}

		return { allowed: true };
	}

	public canUseItemModule(context: AppearanceActionProcessingContext, target: ActionTarget, itemPath: ItemPath, moduleName: string, interaction?: ItemInteractionType): RestrictionResult {
		const item = target.getItem(itemPath);
		// The item must exist to interact with it
		if (!item)
			return {
				allowed: false,
				restriction: {
					type: 'invalid',
				},
			};

		return this.canUseItemModuleDirect(context, target, itemPath.container, item, moduleName, interaction);
	}

	public canUseItemModuleDirect(context: AppearanceActionProcessingContext, target: ActionTarget, container: ItemContainerPath, item: Item, moduleName: string, interaction?: ItemInteractionType): RestrictionResult {
		// The module must exist
		const module = item.getModules().get(moduleName);
		if (!module)
			return {
				allowed: false,
				restriction: {
					type: 'invalid',
				},
			};

		const targetCharacter = context.resolveTargetCharacter(target, [...container, { item: item.id, module: moduleName }]);
		Assert(target.type !== 'character' || target === targetCharacter);

		/** If the action should be considered as "manipulating themselves" for the purpose of self-blocking checks */
		const isSelfAction = targetCharacter != null && targetCharacter.character.id === this.character.id;

		// The module can specify what kind of interaction it provides, unless asking for specific one
		interaction ??= module.interactionType;

		// Must be able to interact with this item in that way
		{
			const r = this.canUseItemDirect(context, target, container, item, interaction);
			if (!r.allowed)
				return r;
		}

		// If the target is a room device, then must be able to interact with the wearable part as well (if there is a target character)
		if (item.isType('roomDevice') && targetCharacter != null) {
			const wearablePart = targetCharacter.getAllItems()
				.filter(FilterItemType('roomDeviceWearablePart'))
				.find((it) => it.roomDeviceLink != null && it.roomDeviceLink.device === item.id);

			if (wearablePart == null) {
				return {
					allowed: false,
					restriction: {
						type: 'invalid',
					},
				};
			}

			const r = this.canUseItemDirect(context, targetCharacter, [], wearablePart, interaction);
			if (!r.allowed)
				return r;
		}

		// If access is all we needed, then success
		if (interaction === ItemInteractionType.ACCESS_ONLY)
			return { allowed: true };

		if (targetCharacter != null) {
			context.addInteraction(targetCharacter.character, module.interactionId);
		}

		const properties = item.isType('roomDevice') ? item.getRoomDeviceProperties() : item.getProperties();

		// If item blocks this module, fail
		if (properties.blockModules.has(moduleName) && !this.forceAllowItemActions())
			return {
				allowed: false,
				restriction: {
					type: 'blockedModule',
					asset: item.asset.id,
					itemName: item.name ?? '',
					module: moduleName,
					self: false,
				},
			};

		// If accessing on self, the item must not block it
		if (isSelfAction && properties.blockSelfModules.has(moduleName) && !this.forceAllowItemActions())
			return {
				allowed: false,
				restriction: {
					type: 'blockedModule',
					asset: item.asset.id,
					itemName: item.name ?? '',
					module: moduleName,
					self: true,
				},
			};

		return { allowed: true };
	}
}
