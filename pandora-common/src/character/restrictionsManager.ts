import _ from 'lodash';
import type { CharacterId } from '.';
import { Asset, Item, ItemId } from '../assets';
import type { Appearance } from '../assets/appearance';
import { EffectsDefinition, EFFECTS_DEFAULT, MergeEffects } from '../assets/effects';
import { AppearanceActionRoomContext } from '../chatroom';

export enum ItemInteractionType {
	/**
	 * Special interaction that doesn't have prerequisites from the character itself.
	 *
	 * Requirements:
	 * - Player can interact with character (handling things like permissions and safeword state)
	 * - Player can use the asset of this item on character (blocked/limited items check; bodyparts can only be changed on self)
	 */
	ACCESS_ONLY = 'ACCESS_ONLY',
	/**
	 * Item modified only in stylistic way (e.g. color)
	 *
	 * Requirements:
	 * - Requires all `ACCESS_ONLY` requirements
	 * - If asset __is__ bodypart:
	 *   - Must not be in room or the room must allow body modification
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
	 * - If asset __is not__ bodypart:
	 *   - Player must be able to use hands
	 *   - If asset has `allowSelfEquip: false`, then cannot happen on self
	 */
	ADD_REMOVE = 'ADD_REMOVE',
}

/**
 * All functions should return a stable value, or useSyncExternalStore will not work properly.
 */
export class CharacterRestrictionsManager {
	public readonly id: CharacterId;
	public readonly appearance: Appearance;
	public readonly room: AppearanceActionRoomContext | null;
	private _items: readonly Item[] = [];
	private _effects: Readonly<EffectsDefinition> = { ...EFFECTS_DEFAULT };

	constructor(id: CharacterId, appearance: Appearance, room: AppearanceActionRoomContext | null) {
		this.id = id;
		this.appearance = appearance;
		this.room = room;
	}

	/**
	 * @returns Stable result for effects
	 */
	public getEffects(): Readonly<EffectsDefinition> {
		const items = this.appearance.getAllItems();
		if (items === this._items) {
			return this._effects;
		}
		this._items = items;
		this._effects = items
			.map((item) => item.getEffects())
			.reduce(MergeEffects, EFFECTS_DEFAULT);

		return this._effects;
	}

	/**
	 * Returns if this character can use hands
	 */
	public canUseHands(): boolean {
		return !this.getEffects().blockHands;
	}

	/**
	 * Calculates the mouth muffling effect
	 * @returns Strength as number in range [0, 10]
	 */
	public getMouthMuffleStrength(): number {
		// WARN: Temp fix!! Takes average of 5 muffling attributes
		const { jawMove, lipsTouch, tongueRoof, mouthBreath, throatBreath } = this.getEffects();

		return _.clamp((jawMove + lipsTouch + tongueRoof + mouthBreath + throatBreath) / 5, 0, 10);
	}

	/**
	 * Calculates the blind level effect
	 * @returns Strength as number in range [0, 10]
	 */
	public getBlindness(): number {
		return _.clamp(this.getEffects().blind, 0, 10);
	}

	public canInteractWithCharacter(_target: CharacterRestrictionsManager): boolean {
		// TODO: For permissions
		return true;
	}

	public canInteractWithAsset(target: CharacterRestrictionsManager, asset: Asset): boolean {
		// Must be able to interact with character
		if (!this.canInteractWithCharacter(target))
			return false;

		// Can do all on self
		if (target.id === this.id)
			return true;

		// Bodyparts can only be changed on self
		if (asset.definition.bodypart != null)
			return false;

		return true;
	}

	public canInteractWithItem(target: CharacterRestrictionsManager, item: Item | ItemId | undefined, interaction: ItemInteractionType): boolean {
		if (typeof item === 'string') {
			item = target.appearance.getItemById(item);
		}
		// The item must exist to interact with it
		if (!item)
			return false;

		// Must be able to use item's asset
		if (!this.canInteractWithAsset(target, item.asset))
			return false;

		// If access is all we needed, then success
		if (interaction === ItemInteractionType.ACCESS_ONLY)
			return true;

		// Bodyparts have different handling (we already checked we can interact with the asset)
		if (item.asset.definition.bodypart != null) {
			// Not all rooms allow bodypart changes
			if (this.room && !this.room.features.includes('allowBodyChanges'))
				return false;
			return true;
		}

		// If equipping on self, the asset must allow self-equip
		if (interaction === ItemInteractionType.ADD_REMOVE && this.id === target.id && !(item.asset.definition.allowSelfEquip ?? true))
			return false;

		// Must be able to use hands
		if (!this.canUseHands())
			return false;

		return true;
	}

	public canInteractWithItemModule(target: CharacterRestrictionsManager, item: Item | ItemId | undefined, moduleName: string): boolean {
		if (typeof item === 'string') {
			item = target.appearance.getItemById(item);
		}
		// The item must exist
		if (!item)
			return false;
		// The module must exist
		const module = item.modules.get(moduleName);
		if (!module)
			return false;

		// The module specifies what kind of interaction it provides
		const interaction: ItemInteractionType = module.config.interactionType ?? ItemInteractionType.MODIFY;

		// Must be able to interact with this item in that way
		if (!this.canInteractWithItem(target, item, interaction))
			return false;

		return true;
	}
}
