import _ from 'lodash';
import type { CharacterId } from '.';
import type { Appearance } from '../assets/appearance';
import { EffectsDefinition, EFFECTS_DEFAULT, MergeEffects } from '../assets/effects';

export class CharacterRestrictionsManager {
	public readonly id: CharacterId;
	public readonly appearance: Appearance;

	constructor(id: CharacterId, appearance: Appearance) {
		this.id = id;
		this.appearance = appearance;
	}

	public getEffects(): EffectsDefinition {
		return this.appearance
			.getAllItems()
			.map((item) => item.asset.definition.effects)
			.reduce(MergeEffects, EFFECTS_DEFAULT);
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
