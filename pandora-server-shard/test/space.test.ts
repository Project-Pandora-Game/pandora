import { describe, expect, it, jest } from '@jest/globals';
import { AssetManager } from 'pandora-common';
import type { Character } from '../src/character/character.ts';

// Avoid loading the asset service's connection and space managers in this unit test.
jest.unstable_mockModule('../src/assets/assetManager.ts', () => ({
	assetManager: new AssetManager(''),
}));

const { Space } = await import('../src/spaces/space.ts');

describe('Space chat status', () => {
	it('deduplicates targets and does not re-send unchanged status', () => {
		const sendMessage = jest.fn();
		const target = { connection: { sendMessage } };
		const space = {
			status: new Map(),
			getCharacterById: () => target,
			sendMessage: jest.fn(),
		} as unknown as InstanceType<typeof Space>;
		const character = { id: 'c1' } as unknown as Character;
		Space.prototype.updateStatus.call(space, character, 'typing', ['c2', 'c3', 'c2']);
		Space.prototype.updateStatus.call(space, character, 'typing', ['c3', 'c2']);
		expect(sendMessage).toHaveBeenCalledTimes(2);
	});
});
