import { castImmutable, type Immutable } from 'immer';
import { clamp } from 'lodash-es';
import type { CharacterAppearance } from '../assets/appearance.ts';
import { SplitContainerPath } from '../assets/appearanceHelpers.ts';
import type { ActionTarget, ItemContainerPath, ItemPath } from '../assets/appearanceTypes.ts';
import { AppearanceItemProperties } from '../assets/appearanceValidation.ts';
import { Asset } from '../assets/asset.ts';
import { EffectsDefinition, MergeEffects } from '../assets/effects.ts';
import { FilterItemType, type Item, type ItemId, type RoomDeviceLink } from '../assets/item/index.ts';
import { AssetPropertiesResult } from '../assets/properties.ts';
import { GetRestrictionOverrideConfig, RestrictionOverrideConfig } from '../assets/state/characterStateTypes.ts';
import { CompoundChatMessageFilter, CustomChatMessageFilter, type ChatMessageFilter } from '../chat/chatMessageFilter.ts';
import { HearingImpairment } from '../chat/hearingImpairment.ts';
import type { ChatMessageBlockingResult, IClientMessage } from '../chat/index.ts';
import { Muffler } from '../chat/muffling.ts';
import type { AppearanceActionProcessingContext } from '../gameLogic/actionLogic/appearanceActionProcessingContext.ts';
import type { GameLogicCharacter } from '../gameLogic/character/character.ts';
import { CHARACTER_MODIFIER_TYPE_DEFINITION } from '../gameLogic/characterModifiers/index.ts';
import type { CharacterModifierEffectData, CharacterModifierEffectDataSpecific, CharacterModifierPropertiesApplier, CharacterModifierSpecificConfig, CharacterModifierType } from '../gameLogic/index.ts';
import type { ActionSpaceContext } from '../space/space.ts';
import { Assert, AssertNever, IsNotNullable, MemoizeNoArg } from '../utility/misc.ts';
import { ItemInteractionType } from './restrictionTypes.ts';

/**
 * All functions should return a stable value, or useSyncExternalStore will not work properly.
 */
export class CharacterRestrictionsManager {
	public readonly appearance: CharacterAppearance;
	public readonly spaceContext: ActionSpaceContext;
	public readonly restrictionOverrideConfig: RestrictionOverrideConfig;
	private readonly _properties: Immutable<AssetPropertiesResult>;
	private readonly _roomDeviceLink: Immutable<RoomDeviceLink> | null;

	public get character(): GameLogicCharacter {
		return this.appearance.character;
	}

	constructor(appearance: CharacterAppearance, spaceContext: ActionSpaceContext) {
		this.appearance = appearance;
		this.spaceContext = spaceContext;
		this.restrictionOverrideConfig = GetRestrictionOverrideConfig(this.appearance.getRestrictionOverride());

		// Calculate caches
		this._properties = AppearanceItemProperties(this.appearance.getAllItems());
		this._roomDeviceLink = this.appearance.characterState.getRoomDeviceWearablePart()?.roomDeviceLink ?? null;
	}

	@MemoizeNoArg
	public getModifierEffects(): readonly Immutable<CharacterModifierEffectData>[] {
		return this.spaceContext.getCharacterModifierEffects(this.appearance.id, this.appearance.gameState);
	}

	public getModifierEffectsByType<const TType extends CharacterModifierType>(type: TType): readonly Immutable<CharacterModifierEffectDataSpecific<TType>>[] {
		return this.getModifierEffects()
			.map((e): Immutable<CharacterModifierEffectDataSpecific<TType>> | undefined => {
				if (e.type !== type)
					return undefined;

				return {
					id: e.id,
					type: castImmutable(type),
					config: castImmutable<CharacterModifierSpecificConfig<TType>>(CHARACTER_MODIFIER_TYPE_DEFINITION[e.type].parseConfig(e)),
				};
			})
			.filter(IsNotNullable);
	}

	@MemoizeNoArg
	public getModifierEffectProperties(): readonly CharacterModifierPropertiesApplier[] {
		return this.getModifierEffects().map((e): CharacterModifierPropertiesApplier => {
			const definition = CHARACTER_MODIFIER_TYPE_DEFINITION[e.type];
			return definition.createPropertiesApplier(e);
		});
	}

	public getProperties(): Immutable<AssetPropertiesResult> {
		return this._properties;
	}

	public getRoomDeviceLink(): Immutable<RoomDeviceLink> | null {
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
	@MemoizeNoArg
	public getEffects(): Readonly<EffectsDefinition> {
		// Get effects from items
		let effects = this.getProperties().effects;

		// Apply effects from modifiers
		for (const modifierEffect of this.getModifierEffectProperties()) {
			if (modifierEffect.applyCharacterEffects != null) {
				effects = MergeEffects(effects, modifierEffect.applyCharacterEffects(effects));
			}
		}

		return effects;
	}

	/**
	 * Returns if this character can use hands
	 */
	public canUseHands(): boolean {
		return !this.getEffects().blockHands;
	}

	/**
	 * Returns the ChatMessageFilter class for processing this character's speech
	 */
	public getSpeechFilter(): ChatMessageFilter {
		const resultFilters: ChatMessageFilter[] = [];

		// Apply effects from "before" modifiers
		for (const modifierEffect of this.getModifierEffectProperties()) {
			if (modifierEffect.processChatMessageBeforeMuffle != null) {
				resultFilters.push(new CustomChatMessageFilter(modifierEffect.processChatMessageBeforeMuffle));
			}
		}

		// Apply standard muffling
		resultFilters.push(new Muffler(this.character.id, this.getEffects()));

		// Apply effects from "after" modifiers
		for (const modifierEffect of this.getModifierEffectProperties().toReversed()) {
			if (modifierEffect.processChatMessageAfterMuffle != null) {
				resultFilters.push(new CustomChatMessageFilter(modifierEffect.processChatMessageAfterMuffle));
			}
		}

		if (resultFilters.length === 1)
			return resultFilters[0];
		return new CompoundChatMessageFilter(resultFilters);

	}

	/**
	 * Returns the ChatMessageFilter class for processing this character's hearing
	 */
	public getHearingFilter(): ChatMessageFilter {
		const resultFilters: ChatMessageFilter[] = [];

		// Apply effects from "before" modifiers
		for (const modifierEffect of this.getModifierEffectProperties()) {
			if (modifierEffect.processReceivedChatMessageBeforeFilters != null) {
				resultFilters.push(new CustomChatMessageFilter(modifierEffect.processReceivedChatMessageBeforeFilters));
			}
		}

		// Apply standard effects
		resultFilters.push(new HearingImpairment(this.character.id, this.getEffects()));

		// Apply effects from "after" modifiers
		for (const modifierEffect of this.getModifierEffectProperties().toReversed()) {
			if (modifierEffect.processReceivedChatMessageAfterFilters != null) {
				resultFilters.push(new CustomChatMessageFilter(modifierEffect.processReceivedChatMessageAfterFilters));
			}
		}

		if (resultFilters.length === 1)
			return resultFilters[0];
		return new CompoundChatMessageFilter(resultFilters);
	}

	/** Check whether this character is allowed to say this message */
	public checkChatMessage(message: IClientMessage): ChatMessageBlockingResult {
		// Only normal chat messages can be affected
		if (message.type !== 'chat')
			return { result: 'ok' };

		// Run modifier checks
		for (const modifierEffect of this.getModifierEffectProperties()) {
			if (modifierEffect.checkChatMessage != null) {
				const check = modifierEffect.checkChatMessage(message);
				if (check.result !== 'ok') {
					return {
						result: 'block',
						reason: `Blocked by character modifier "${CHARACTER_MODIFIER_TYPE_DEFINITION[modifierEffect.effect.type].visibleName}":\n` + check.reason,
					};
				}
			}
		}

		// Otherwise allow the message
		return { result: 'ok' };
	}

	/**
	 * Calculates the blind level effect
	 * @returns Strength as number in range [0, 10]
	 */
	public getBlindness(): number {
		return clamp(this.getEffects().blind, 0, 10);
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

	/**
	 * Check that this character can use hands.
	 * @param context - Context of the action
	 * @param allowStruggleBypass - Whether this action allows using an "action attempt" to bypass blocked hands limitation
	 * (`false` = blocked hands block | `true` = blocked hands slow down)
	 */
	public checkUseHands(context: AppearanceActionProcessingContext, allowStruggleBypass: boolean): void {
		// Safemode bypasses this check
		if (!this.canUseHands() && !this.forceAllowItemActions()) {
			if (allowStruggleBypass) {
				context.addSlowdown('blockedHands');
			} else {
				context.addRestriction({ type: 'blockedHands' });
			}
		}
	}

	public checkInteractWithTarget(context: AppearanceActionProcessingContext, target: ActionTarget): void {
		if (target.type === 'character') {
			// Have all permissions on self
			if (target.character.id === this.character.id)
				return;

			const targetCharacter = target.getRestrictionManager(this.spaceContext);

			// Mark as interaction
			context.addInteraction(target.character, 'interact');

			// Check interaction block (safe mode, timeout)
			if (this.isInteractionBlocked() || targetCharacter.isInteractionBlocked()) {
				context.addRestriction({
					type: 'safemodeInteractOther',
				});
			}

			// Check that target can be reached from current room. Applies to both admins and non-admins.
			const playerRoom = this.appearance.getCurrentRoom();
			const targetRoom = target.getCurrentRoom();
			if (playerRoom != null && targetRoom != null) {
				if (playerRoom.id !== targetRoom.id && playerRoom.getLinkToRoom(targetRoom) == null) {
					context.addRestriction({ type: 'tooFar', subtype: 'characterInteraction' });
				}
			} else {
				context.addRestriction({ type: 'invalid' });
			}
		} else if (target.type === 'room') {
			// Non-admins can only interact with current room and rooms that can be reached from it.
			const playerRoom = this.appearance.getCurrentRoom();
			if (!this.isCurrentSpaceAdmin()) {
				if (playerRoom != null) {
					if (playerRoom.id !== target.roomState.id && playerRoom.getLinkToRoom(target.roomState) == null) {
						context.addRestriction({ type: 'tooFar', subtype: 'roomTarget' });
					}
				} else {
					context.addRestriction({ type: 'invalid' });
				}
			}
		} else {
			AssertNever(target);
		}
	}

	public checkUseAsset(context: AppearanceActionProcessingContext, target: ActionTarget, asset: Asset): void {
		// Must be able to interact with character
		this.checkInteractWithTarget(context, target);

		// Non-character inventories have no other restrictions
		if (target.type !== 'character')
			return;

		// Can do all on self
		if (target.character.id === this.character.id)
			return;

		const resolution = target.character.assetPreferences.resolveAssetPreference(asset, this.character.id);
		switch (resolution.preference) {
			case 'doNotRender':
			case 'prevent':
				context.addRestriction({
					type: 'missingAssetPermission',
					target: target.character.id,
					resolution,
				});
				break;
			case 'maybe':
				context.addRequiredPermission(
					target.character.assetPreferences.getPreferencePermission('maybe'),
				);
			// Fallthrough
			case 'normal':
				context.addRequiredPermission(
					target.character.assetPreferences.getPreferencePermission('normal'),
				);
			// Fallthrough
			case 'favorite':
				context.addRequiredPermission(
					target.character.assetPreferences.getPreferencePermission('favorite'),
				);
				break;
			default:
				AssertNever(resolution.preference);
		}
	}

	public checkPermissionForItemContents(context: AppearanceActionProcessingContext, target: ActionTarget, item: Item): void {
		// Permission on the item itself is intentionally not checked

		// Iterate over whole content
		for (const module of item.getModules().keys()) {
			for (const innerItem of item.getModuleItems(module)) {
				// Check the item can be used
				this.checkUseAsset(context, target, innerItem.asset);
				// Check its content can be used
				this.checkPermissionForItemContents(context, target, innerItem);
			}
		}
	}

	/**
	 * Validate if this character can use item on target in specific way, supplying the path to the item
	 * @param target - Target on which the item is being interected with
	 * @param itemPath - Path to the item
	 * @param interaction - What kind of interaction to check against
	 * @param insertBeforeRootItem - Simulate the item being positioned before (under) this item. Undefined means that it either is currently present or that it is to be inserted to the end.
	 */
	public checkUseItem(context: AppearanceActionProcessingContext, target: ActionTarget, itemPath: ItemPath, interaction: ItemInteractionType, insertBeforeRootItem?: ItemId): void {
		const item = target.getItem(itemPath);
		// The item must exist to interact with it
		if (!item) {
			context.addRestriction({ type: 'invalid' });
			return;
		}

		this.checkUseItemDirect(context, target, itemPath.container, item, interaction, insertBeforeRootItem);
	}

	/**
	 * Validate if this character can use item on target in specific way, supplying the item itself
	 * @param target - Target on which the item is being interected with
	 * @param container - Container in which the item is
	 * @param item - The item itself, as object
	 * @param interaction - What kind of interaction to check against
	 * @param insertBeforeRootItem - Simulate the item being positioned before (under) this item. Undefined means that it either is currently present or that it is to be inserted to the end.
	 */
	public checkUseItemDirect(context: AppearanceActionProcessingContext, target: ActionTarget, container: ItemContainerPath, item: Item, interaction: ItemInteractionType, insertBeforeRootItem?: ItemId): void {

		// Must validate insertBeforeRootItem, if present
		if (insertBeforeRootItem && target.getItem({ container: [], itemId: insertBeforeRootItem }) == null) {
			context.addRestriction({ type: 'invalid' });
			return;
		}

		const permissionTarget = context.resolvePermissionTarget(target, container);
		Assert(target.type !== 'character' || target === permissionTarget);

		// Must be able to use item's asset
		this.checkUseAsset(context, permissionTarget, item.asset);

		/** If the action should be considered as "manipulating themselves" for the purpose of self-blocking checks */
		const isSelfAction = permissionTarget.type === 'character' && permissionTarget.character.id === this.character.id;
		const forceAllowItemActions = this.forceAllowItemActions();
		/** Whether the item is physically equipped (on a character, or on some item; in contrast to simply being stored e.g. in a bag) */
		let isPhysicallyEquipped = target.type === 'character';

		// Must be able to access all upper items
		const upperPath = SplitContainerPath(container);
		if (upperPath) {
			const upperItem = target.getItem(upperPath.itemPath);
			const containingModule = upperItem?.getModules().get(upperPath.module);
			if (!containingModule) {
				context.addRestriction({ type: 'invalid' });
				return;
			}

			isPhysicallyEquipped = containingModule.contentsPhysicallyEquipped;

			this.checkUseItemModule(
				context,
				target,
				upperPath.itemPath,
				upperPath.module,
				interaction === ItemInteractionType.ACCESS_ONLY ? ItemInteractionType.ACCESS_ONLY : ItemInteractionType.MODIFY,
			);
		}

		// If access is all we needed, then success
		if (interaction === ItemInteractionType.ACCESS_ONLY)
			return;

		// Add interactrions based on interaction type
		if (interaction === ItemInteractionType.STYLING) {
			if (permissionTarget.type === 'character') {
				context.addInteraction(permissionTarget.character, 'changeItemColor');
			}
		}
		if (interaction === ItemInteractionType.CUSTOMIZE) {
			if (permissionTarget.type === 'character') {
				context.addInteraction(permissionTarget.character, 'customizeItem');
			}
		}

		// Bodyparts have different handling (we already checked we can interact with the asset)
		if (item.isType('bodypart')) {
			// Only characters have bodyparts
			if (target.type !== 'character') {
				context.addRestriction({ type: 'invalid' });
				return;
			}

			// Get bodypart descriptor of the target item
			const bodypart = this.appearance.getAssetManager().bodyparts.find((b) => b.name === item.asset.definition.bodypart);
			Assert(bodypart != null, `Bodypart definition '${item.asset.definition.bodypart}' of bodypart item not found`);

			// Not all rooms allow bodypart changes (changing expression is allowed and some bodyparts can be changed anywhere)
			if (
				!this.spaceContext.features.includes('allowBodyChanges') &&
				interaction !== ItemInteractionType.EXPRESSION_CHANGE &&
				!bodypart.adjustable
			) {
				context.addRestriction({
					type: 'modifyBodyRoom',
				});
			}

			// Bodyparts have special interaction type
			context.addInteraction(target.character, 'modifyBody');

			// Otherwise success
			return;
		}

		// Changing expression makes sense only on bodyparts
		if (interaction === ItemInteractionType.EXPRESSION_CHANGE) {
			context.addRestriction({ type: 'invalid' });
			return;
		}

		// To add or remove the item, we need to have access to all contained items
		if (interaction === ItemInteractionType.ADD_REMOVE || interaction === ItemInteractionType.DEVICE_ENTER_LEAVE) {
			this.checkPermissionForItemContents(context, permissionTarget, item);
		}

		// Enter/Leave interaction is only allowed on room devices and their wearable parts
		if (interaction === ItemInteractionType.DEVICE_ENTER_LEAVE) {
			if (!item.asset.isType('roomDevice') && !item.asset.isType('roomDeviceWearablePart')) {
				context.addRestriction({ type: 'invalid' });
				return;
			}
		}

		const properties = item.getProperties();

		// If equipping (or entering a device) there are further checks
		if ((interaction === ItemInteractionType.ADD_REMOVE || interaction === ItemInteractionType.DEVICE_ENTER_LEAVE) && isPhysicallyEquipped) {
			// If item blocks add/remove, fail
			if (properties.blockAddRemove && !forceAllowItemActions) {
				context.addRestriction({
					type: 'blockedAddRemove',
					asset: item.asset.id,
					itemName: item.name ?? '',
				});
			}
		}

		// Check for items covered/blocked by other items
		if (isPhysicallyEquipped && !forceAllowItemActions && target.type === 'character') {
			const targetProperties = target.getRestrictionManager(this.spaceContext).getLimitedProperties({
				from: insertBeforeRootItem ?? (container.length > 0 ? container[0].item : item.id),
				exclude: container.length > 0 ? container[0].item : item.id,
			});
			const coveredAttribute = Array.from(properties.attributes).find((a) => targetProperties.attributesCovers.has(a));
			if (coveredAttribute != null) {
				context.addRestriction({
					type: 'covered',
					asset: item.asset.id,
					itemName: item.name ?? '',
					attribute: coveredAttribute,
				});
			}
		}

		// Must be able to use hands (for everything except entering/leaving a room device)
		if (
			interaction === ItemInteractionType.STYLING ||
			interaction === ItemInteractionType.CUSTOMIZE ||
			interaction === ItemInteractionType.MODIFY ||
			interaction === ItemInteractionType.ADD_REMOVE ||
			interaction === ItemInteractionType.REORDER
		) {
			let allowStruggleBypass: boolean;
			switch (interaction) {
				case ItemInteractionType.STYLING:
				case ItemInteractionType.CUSTOMIZE:
					allowStruggleBypass = false;
					break;
				case ItemInteractionType.MODIFY:
				case ItemInteractionType.ADD_REMOVE:
				case ItemInteractionType.REORDER:
					allowStruggleBypass = (item.isType('personal') || item.isType('roomDevice')) ? !item.requireFreeHandsToUse :
						item.isType('roomDeviceWearablePart') ? !(item.roomDevice?.requireFreeHandsToUse ?? false) :
							true;
					break;
				default:
					AssertNever(interaction);
			}
			this.checkUseHands(context, allowStruggleBypass);
		}
	}

	public checkUseItemModule(context: AppearanceActionProcessingContext, target: ActionTarget, itemPath: ItemPath, moduleName: string, interaction?: ItemInteractionType): void {
		const item = target.getItem(itemPath);
		// The item must exist to interact with it
		if (!item) {
			context.addRestriction({ type: 'invalid' });
			return;
		}

		this.checkUseItemModuleDirect(context, target, itemPath.container, item, moduleName, interaction);
	}

	public checkUseItemModuleDirect(context: AppearanceActionProcessingContext, target: ActionTarget, container: ItemContainerPath, item: Item, moduleName: string, interaction?: ItemInteractionType): void {
		// The module must exist
		const module = item.getModules().get(moduleName);
		if (!module) {
			context.addRestriction({ type: 'invalid' });
			return;
		}

		const permissionTarget = context.resolvePermissionTarget(target, [...container, { item: item.id, module: moduleName }]);
		Assert(target.type !== 'character' || target === permissionTarget);

		/** If the action should be considered as "manipulating themselves" for the purpose of self-blocking checks */
		const isSelfAction = permissionTarget.type === 'character' && permissionTarget.character.id === this.character.id;

		// The module can specify what kind of interaction it provides, unless asking for specific one
		interaction ??= module.interactionType;

		// Must be able to interact with this item in that way
		this.checkUseItemDirect(context, target, container, item, interaction);

		// If the target is a room device, then must be able to interact with the wearable part as well (if there is a target character)
		if (item.isType('roomDevice') && permissionTarget.type === 'character') {
			const wearablePart = permissionTarget.getAllItems()
				.filter(FilterItemType('roomDeviceWearablePart'))
				.find((it) => it.roomDeviceLink != null && it.roomDeviceLink.device === item.id);

			if (wearablePart == null) {
				context.addRestriction({ type: 'invalid' });
				return;
			}

			this.checkUseItemDirect(context, permissionTarget, [], wearablePart, interaction);
		}

		// If access is all we needed, then success
		if (interaction === ItemInteractionType.ACCESS_ONLY)
			return;

		if (permissionTarget.type === 'character') {
			context.addInteraction(permissionTarget.character, module.interactionId);
		}

		const properties = item.isType('roomDevice') ? item.getRoomDeviceProperties() : item.getProperties();

		// If item blocks this module, fail
		if (properties.blockModules.has(moduleName) && !this.forceAllowItemActions()) {
			context.addRestriction({
				type: 'blockedModule',
				asset: item.asset.id,
				itemName: item.name ?? '',
				module: moduleName,
			});
		}
	}

	/**
	 * Check whether user is allowed to spawn a new item
	 * @param context - Context of the action
	 * @param item - Item that is being spanwed
	 */
	public checkSpawnItem(context: AppearanceActionProcessingContext, item: Item): void {
		// The item must be spawn-able
		if (!item.asset.canBeSpawned()) {
			context.addRestriction({ type: 'invalid' });
		}

		// Must be able to use hands to spawn a new item
		this.checkUseHands(context, false);
	}

	/**
	 * Check whether user is allowed to delete an item
	 * @param context - Context of the action
	 * @param item - Item that user wants to delete
	 */
	public checkDeleteItem(context: AppearanceActionProcessingContext, _item: Item): void {
		// Must be able to use hands to delete an item
		this.checkUseHands(context, false);
	}
}
