import _ from 'lodash';
import type { CharacterAppearance } from '../assets/appearance';
import { EffectsDefinition } from '../assets/effects';
import { AssetPropertiesResult, CreateAssetPropertiesResult } from '../assets/properties';
import { ActionRoomContext } from '../chatroom';
import { Muffler } from '../character/speech';
import { SplitContainerPath } from '../assets/appearanceHelpers';
import type { Item, RoomDeviceLink } from '../assets/item';
import type { AppearanceActionProcessingContext, Asset, AssetId, ItemContainerPath, ItemId, ItemPath, RoomActionTarget } from '../assets';
import { AppearanceItemProperties } from '../assets/appearanceValidation';
import { Immutable } from 'immer';
import { GameLogicCharacter } from '../gameLogic/character/character';
import { PermissionGroup } from '../gameLogic';
import { CharacterId } from './characterTypes';
import { ResolveAssetPreference } from './assetPreferences';

export enum ItemInteractionType {
	/**
	 * Special interaction that doesn't have prerequisites from the character itself.
	 *
	 * Requirements:
	 * - Player can interact with character (handling things like permissions and safeword state)
	 * - Player can use the asset of this item on character (blocked/limited items check)
	 */
	ACCESS_ONLY = 'ACCESS_ONLY',
	/**
	 * Special interaction for changing expression
	 *
	 * Requirements:
	 * - Requires all `ACCESS_ONLY` requirements
	 * - If asset __is__ bodypart:
	 *   - Must be targetting herself
	 * - If asset __is not__ bodypart this action is invalid (never allowed)
	 */
	EXPRESSION_CHANGE = 'EXPRESSION_CHANGE',
	/**
	 * Item modified only in stylistic way (e.g. color)
	 *
	 * Requirements:
	 * - Requires all `ACCESS_ONLY` requirements
	 * - If asset __is__ bodypart:
	 *   - Must not be in room or the room must allow body modification
	 *   - Must be targetting herself
	 * - If asset __is not__ bodypart:
	 *   - Player must be able to use hands
	 */
	STYLING = 'STYLING',
	/**
	 * Item being modified (e.g. changing its behavior or configuration)
	 *
	 * Requirements:
	 * - Requires all `ACCESS_ONLY` requirements
	 * - If asset __is__ bodypart:
	 *   - Must not be in room or the room must allow body modification
	 *   - Must be targetting herself
	 * - If asset __is not__ bodypart:
	 *   - Player must be able to use hands
	 */
	MODIFY = 'MODIFY',
	/**
	 * Item being added, removed or reordered.
	 *
	 * Requirements:
	 * - Requires all `ACCESS_ONLY` requirements
	 * - If asset __is__ bodypart:
	 *   - Must not be in room or the room must allow body modification
	 *   - Must be targetting herself
	 * - If asset __is not__ bodypart:
	 *   - Player must be able to use hands
	 *   - If asset has `blockAddRemove`, then denied
	 *   - If asset has `blockSelfAddRemove`, then cannot happen on self
	 */
	ADD_REMOVE = 'ADD_REMOVE',
}

export type PermissionRestriction = {
	type: 'missingPermission';
	target: CharacterId;
	permissionGroup: PermissionGroup;
	permissionId: string;
	permissionDescription: string;
};

export type Restriction =
	| PermissionRestriction
	| {
		type: 'blockedByPreference';
		target: CharacterId;
		source: 'character' | 'room';
	}
	| {
		type: 'blockedAddRemove';
		asset: AssetId;
		self: boolean;
	}
	| {
		type: 'blockedModule';
		asset: AssetId;
		module: string;
		self: boolean;
	}
	| {
		type: 'covered';
		asset: AssetId;
		attribute: string;
	}
	| {
		type: 'blockedHands';
	}
	| {
		type: 'safemodeInteractOther';
	}
	| {
		type: 'modifyBodyRoom';
	}
	| {
		type: 'modifyRoomRestriction';
		reason: 'notAdmin' | 'missingConstructionTools';
	}
	// Generic catch-all problem, supposed to be used when something simply went wrong (like bad data, target not found, and so on...)
	| {
		type: 'invalid';
	};

export type RestrictionResult = {
	allowed: true;
} | {
	allowed: false;
	restriction: Restriction;
};

/**
 * All functions should return a stable value, or useSyncExternalStore will not work properly.
 */
export class CharacterRestrictionsManager {
	public readonly appearance: CharacterAppearance;
	public readonly room: ActionRoomContext;
	private _items: readonly Item[] = [];
	private _properties: Immutable<AssetPropertiesResult> = CreateAssetPropertiesResult();
	private _roomDeviceLink: Immutable<RoomDeviceLink> | null = null;

	public get character(): GameLogicCharacter {
		return this.appearance.character;
	}

	constructor(appearance: CharacterAppearance, room: ActionRoomContext) {
		this.appearance = appearance;
		this.room = room;
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
	 * Calculates the blind level effect
	 * @returns Strength as number in range [0, 10]
	 */
	public getBlindness(): number {
		return _.clamp(this.getEffects().blind, 0, 10);
	}

	public isInteractionBlocked(): boolean {
		return this.appearance.isInSafemode();
	}

	public forceAllowItemActions(): boolean {
		return this.appearance.isInSafemode();
	}

	public forceAllowRoomLeave(): boolean {
		return this.appearance.isInSafemode();
	}

	public isCurrentRoomAdmin(): boolean {
		if (this.room.isAdmin(this.character.accountId))
			return true;

		return false;
	}

	public canInteractWithTarget(context: AppearanceActionProcessingContext, target: RoomActionTarget): RestrictionResult {
		// Room inventory can always be interacted with
		if (target.type === 'roomInventory')
			return { allowed: true };

		if (target.type === 'character') {
			// Have all permissions on self
			if (target.character.id === this.character.id)
				return { allowed: true };

			const targetCharacter = target.getRestrictionManager(this.room);

			// Mark as interaction
			context.addInteraction(target.character, 'interact');

			// Safemode checks
			if (this.isInteractionBlocked() || targetCharacter.isInteractionBlocked())
				return {
					allowed: false,
					restriction: {
						type: 'safemodeInteractOther',
					},
				};
		}

		return { allowed: true };
	}

	public canUseAsset(context: AppearanceActionProcessingContext, target: RoomActionTarget, asset: Asset): RestrictionResult {
		// Must be able to interact with character
		const r = this.canInteractWithTarget(context, target);
		if (!r.allowed)
			return r;

		if (target.type === 'character') {
			// Can do all on self
			if (target.character.id === this.character.id)
				return { allowed: true };

			switch (ResolveAssetPreference(target.character.assetPreferences, asset, this.character.id)) {
				case 'doNotRender':
				case 'prevent':
					return {
						allowed: false,
						restriction: {
							type: 'blockedByPreference',
							target: target.character.id,
							source: 'character',
						},
					};
				case 'favorite':
				case 'normal':
				case 'maybe':
					break;
			}
		}

		return { allowed: true };
	}

	public hasPermissionForItemContents(context: AppearanceActionProcessingContext, target: RoomActionTarget, item: Item): RestrictionResult {
		// Iterate over whole content
		for (const module of item.getModules().keys()) {
			for (const innerItem of item.getModuleItems(module)) {
				let r = this.canUseItemDirect(context, target, [], innerItem, ItemInteractionType.ACCESS_ONLY);
				if (!r.allowed)
					return r;
				r = this.hasPermissionForItemContents(context, target, innerItem);
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
	public canUseItem(context: AppearanceActionProcessingContext, target: RoomActionTarget, itemPath: ItemPath, interaction: ItemInteractionType, insertBeforeRootItem?: ItemId): RestrictionResult {
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
	public canUseItemDirect(context: AppearanceActionProcessingContext, target: RoomActionTarget, container: ItemContainerPath, item: Item, interaction: ItemInteractionType, insertBeforeRootItem?: ItemId): RestrictionResult {
		// Must validate insertBeforeRootItem, if present
		if (insertBeforeRootItem && target.getItem({ container: [], itemId: insertBeforeRootItem }) == null)
			return {
				allowed: false,
				restriction: {
					type: 'invalid',
				},
			};

		// Must be able to use item's asset
		let r = this.canUseAsset(context, target, item.asset);
		if (!r.allowed)
			return r;

		const isCharacter = target.type === 'character';
		const isSelfAction = isCharacter && target.character.id === this.character.id;
		const forceAllowItemActions = this.forceAllowItemActions();
		let isPhysicallyEquipped = isCharacter;

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
				!this.room.features.includes('allowBodyChanges') &&
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
		if (interaction === ItemInteractionType.ADD_REMOVE) {
			r = this.hasPermissionForItemContents(context, target, item);
			if (!r.allowed)
				return r;
		}

		const properties = item.getProperties();

		// If equipping there are further checks
		if (interaction === ItemInteractionType.ADD_REMOVE && isPhysicallyEquipped) {
			// If item blocks add/remove, fail
			if (properties.blockAddRemove && !forceAllowItemActions)
				return {
					allowed: false,
					restriction: {
						type: 'blockedAddRemove',
						asset: item.asset.id,
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
						self: true,
					},
				};
		}

		if (isCharacter && isPhysicallyEquipped && !forceAllowItemActions) {
			const targetProperties = target.getRestrictionManager(this.room).getLimitedProperties({
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
						attribute: coveredAttribute,
					},
				};
			}
		}

		// Must be able to use hands
		if (!this.canUseHands() && !forceAllowItemActions)
			return {
				allowed: false,
				restriction: {
					type: 'blockedHands',
				},
			};

		return { allowed: true };
	}

	public canUseItemModule(context: AppearanceActionProcessingContext, target: RoomActionTarget, itemPath: ItemPath, moduleName: string, interaction?: ItemInteractionType): RestrictionResult {
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

	public canUseItemModuleDirect(context: AppearanceActionProcessingContext, target: RoomActionTarget, container: ItemContainerPath, item: Item, moduleName: string, interaction?: ItemInteractionType): RestrictionResult {
		// The module must exist
		const module = item.getModules().get(moduleName);
		if (!module)
			return {
				allowed: false,
				restriction: {
					type: 'invalid',
				},
			};

		const isSelfAction = target.type === 'character' && target.character.id === this.character.id;

		// The module can specify what kind of interaction it provides, unless asking for specific one
		interaction ??= module.interactionType;

		// Must be able to interact with this item in that way
		const r = this.canUseItemDirect(context, target, container, item, interaction);
		if (!r.allowed)
			return r;

		// If access is all we needed, then success
		if (interaction === ItemInteractionType.ACCESS_ONLY)
			return { allowed: true };

		const properties = item.isType('roomDevice') ? item.getRoomDeviceProperties() : item.getProperties();

		// If item blocks this module, fail
		if (properties.blockModules.has(moduleName) && !this.forceAllowItemActions())
			return {
				allowed: false,
				restriction: {
					type: 'blockedModule',
					asset: item.asset.id,
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
					module: moduleName,
					self: true,
				},
			};

		return { allowed: true };
	}
}
