import _ from 'lodash';
import type { CharacterId } from '.';
import type { CharacterAppearance } from '../assets/appearance';
import { EffectsDefinition } from '../assets/effects';
import { AssetPropertiesResult, CreateAssetPropertiesResult, MergeAssetProperties } from '../assets/properties';
import { AppearanceActionRoomContext } from '../chatroom';
import { Muffler } from '../character/speech';
import { SplitContainerPath } from '../assets/appearanceHelpers';
import type { Item } from '../assets/item';
import type { Asset } from '../assets/asset';
import type { AssetId, ItemContainerPath, ItemPath, RoomActionTarget } from '../assets';

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

export type Restriction =
	| {
		type: 'permission';
		missingPermission:
		| 'modifyBodyOthers'
		| 'modifyBodyRoom'
		| 'safemodeInteractOther';
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
		type: 'blockedHands';
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
	public readonly characterId: CharacterId;
	public readonly appearance: CharacterAppearance;
	public readonly room: AppearanceActionRoomContext | null;
	private _items: readonly Item[] = [];
	private _properties: Readonly<AssetPropertiesResult> = CreateAssetPropertiesResult();

	constructor(characterId: CharacterId, appearance: CharacterAppearance, room: AppearanceActionRoomContext | null) {
		this.characterId = characterId;
		this.appearance = appearance;
		this.room = room;
	}

	public getProperties(): Readonly<AssetPropertiesResult> {
		const items = this.appearance.getAllItems();
		if (items === this._items) {
			return this._properties;
		}
		this._items = items;
		this._properties = items
			.flatMap((item) => item.getPropertiesParts())
			.reduce(MergeAssetProperties, CreateAssetPropertiesResult());

		return this._properties;
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
		return new Muffler(this.characterId, this.getEffects());
	}

	/**
	 * Calculates the blind level effect
	 * @returns Strength as number in range [0, 10]
	 */
	public getBlindness(): number {
		return _.clamp(this.getEffects().blind, 0, 10);
	}

	public isInSafemode(): boolean {
		return this.appearance.getSafemode() != null;
	}

	public canInteractWithTarget(target: RoomActionTarget): RestrictionResult {
		// Room inventory can always be intereacted with
		if (target.type === 'roomInventory')
			return { allowed: true };

		if (target.type === 'character') {
			// Have all permissions on self
			if (target.characterId === this.characterId)
				return { allowed: true };

			const targetCharacter = target.getRestrictionManager(this.room);

			// TODO: For other permissions

			// Safemode checks
			if (this.isInSafemode() || targetCharacter.isInSafemode())
				return {
					allowed: false,
					restriction: {
						type: 'permission',
						missingPermission: 'safemodeInteractOther',
					},
				};
		}

		return { allowed: true };
	}

	public canUseAsset(target: RoomActionTarget, _asset: Asset): RestrictionResult {
		// Must be able to interact with character
		const r = this.canInteractWithTarget(target);
		if (!r.allowed)
			return r;

		// Can do all on self
		if (target.type === 'character' && target.characterId === this.characterId)
			return { allowed: true };

		return { allowed: true };
	}

	public hasPermissionForItemContents(target: RoomActionTarget, item: Item): RestrictionResult {
		// Iterate over whole content
		for (const module of item.modules.keys()) {
			for (const innerItem of item.getModuleItems(module)) {
				let r = this.canUseItemDirect(target, [], innerItem, ItemInteractionType.ACCESS_ONLY);
				if (!r.allowed)
					return r;
				r = this.hasPermissionForItemContents(target, innerItem);
				if (!r.allowed)
					return r;
			}
		}
		return { allowed: true };
	}

	public canUseItem(target: RoomActionTarget, itemPath: ItemPath, interaction: ItemInteractionType): RestrictionResult {
		const item = target.getItem(itemPath);
		// The item must exist to interact with it
		if (!item)
			return {
				allowed: false,
				restriction: {
					type: 'invalid',
				},
			};

		return this.canUseItemDirect(target, itemPath.container, item, interaction);
	}

	public canUseItemDirect(target: RoomActionTarget, container: ItemContainerPath, item: Item, interaction: ItemInteractionType): RestrictionResult {
		// Must be able to use item's asset
		let r = this.canUseAsset(target, item.asset);
		if (!r.allowed)
			return r;

		let isPhysicallyEquipped = true;
		const isSelfAction = target.type === 'character' && target.characterId === this.characterId;

		// Must be able to access all upper items
		const upperPath = SplitContainerPath(container);
		if (upperPath) {
			const containingModule = target.getItem(upperPath.itemPath)?.modules.get(upperPath.module);
			if (!containingModule)
				return {
					allowed: false,
					restriction: {
						type: 'invalid',
					},
				};

			isPhysicallyEquipped = containingModule.contentsPhysicallyEquipped;

			r = this.canUseItemModule(
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
		if (item.asset.definition.bodypart != null) {
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
				this.room &&
				!this.room.features.includes('allowBodyChanges') &&
				interaction !== ItemInteractionType.EXPRESSION_CHANGE
			) {
				return {
					allowed: false,
					restriction: {
						type: 'permission',
						missingPermission: 'modifyBodyRoom',
					},
				};
			}

			// Bodyparts can only be changed on self
			if (target.characterId !== this.characterId)
				return {
					allowed: false,
					restriction: {
						type: 'permission',
						missingPermission: 'modifyBodyOthers',
					},
				};

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
			r = this.hasPermissionForItemContents(target, item);
			if (!r.allowed)
				return r;
		}

		const properties = item.getProperties();

		// If equipping there are further checks
		if (interaction === ItemInteractionType.ADD_REMOVE && isPhysicallyEquipped) {
			// If item blocks add/remove, fail
			if (properties.blockAddRemove && !this.isInSafemode())
				return {
					allowed: false,
					restriction: {
						type: 'blockedAddRemove',
						asset: item.asset.id,
						self: false,
					},
				};

			// If equipping on self, the asset must allow self-equip
			if (isSelfAction && properties.blockSelfAddRemove && !this.isInSafemode())
				return {
					allowed: false,
					restriction: {
						type: 'blockedAddRemove',
						asset: item.asset.id,
						self: true,
					},
				};
		}

		// Must be able to use hands
		if (!this.canUseHands() && !this.isInSafemode())
			return {
				allowed: false,
				restriction: {
					type: 'blockedHands',
				},
			};

		return { allowed: true };
	}

	public canUseItemModule(target: RoomActionTarget, itemPath: ItemPath, moduleName: string, interaction?: ItemInteractionType): RestrictionResult {
		const item = target.getItem(itemPath);
		// The item must exist to interact with it
		if (!item)
			return {
				allowed: false,
				restriction: {
					type: 'invalid',
				},
			};

		return this.canUseItemModuleDirect(target, itemPath.container, item, moduleName, interaction);
	}

	public canUseItemModuleDirect(target: RoomActionTarget, container: ItemContainerPath, item: Item, moduleName: string, interaction?: ItemInteractionType): RestrictionResult {
		// The module must exist
		const module = item.modules.get(moduleName);
		if (!module)
			return {
				allowed: false,
				restriction: {
					type: 'invalid',
				},
			};

		const isSelfAction = target.type === 'character' && target.characterId === this.characterId;

		// The module can specify what kind of interaction it provides, unless asking for specific one
		interaction ??= module.interactionType;

		// Must be able to interact with this item in that way
		const r = this.canUseItemDirect(target, container, item, interaction);
		if (!r.allowed)
			return r;

		// If access is all we needed, then success
		if (interaction === ItemInteractionType.ACCESS_ONLY)
			return { allowed: true };

		const properties = item.getProperties();

		// If item blocks this module, fail
		if (properties.blockModules.has(moduleName) && !this.isInSafemode())
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
		if (isSelfAction && properties.blockSelfModules.has(moduleName) && !this.isInSafemode())
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
