import _ from 'lodash';
import type { CharacterId } from '.';
import type { Appearance } from '../assets/appearance';
import type { Item } from '../assets/item';
import { EffectsDefinition, EFFECTS_DEFAULT, MergeEffects } from '../assets/effects';

/**
 * All functions should return a stable value, or useSyncExternalStore will not work properly.
 */
export class CharacterRestrictionsManager {
	public readonly id: CharacterId;
	public readonly appearance: Appearance;
	private _items: readonly Item[] = [];
	private _effects: Readonly<EffectsDefinition> = { ...EFFECTS_DEFAULT };

	constructor(id: CharacterId, appearance: Appearance) {
		this.id = id;
		this.appearance = appearance;
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
		return _.clamp(this.getEffects().muffleMouth, 0, 10);
	}
}
