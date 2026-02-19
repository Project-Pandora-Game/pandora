import { Assert } from 'pandora-common';
import type { Character } from '../account/character.ts';
import type { Space } from './space.ts';

export class SpaceSwitchCoordinator {
	public readonly characters: readonly Character[];
	public readonly initiator: Character;
	public readonly originalSpace: Space;
	public readonly newSpace: Space;

	constructor(characters: Character[], initiator: Character, originalSpace: Space, newSpace: Space) {
		Assert(characters.includes(initiator));

		this.characters = characters;
		this.initiator = initiator;
		this.originalSpace = originalSpace;
		this.newSpace = newSpace;
	}

	public async run(): Promise<'ok'> {
		// TODO: Handle synchronization
		// TODO: Handle
		// TODO: Automatic invite if initiated by admin

		const result = await Promise.all(this.characters.map((c) => c.switchSpace(this.newSpace)));
		return 'ok';
	}
}
