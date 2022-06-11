import { renderHook } from '@testing-library/react';
import _ from 'lodash';
import { CHARACTER_DEFAULT_PUBLIC_SETTINGS, ICharacterData } from 'pandora-common';
import { Player, PlayerCharacter, usePlayerData } from '../../src/character/player';

describe('PlayerCharacter', () => {
	const updateListener = jest.fn();

	let player: PlayerCharacter;
	let onUpdateUnsubscribe: () => void;

	afterEach(() => {
		if (onUpdateUnsubscribe) {
			onUpdateUnsubscribe();
		}
	});

	describe('setCreationComplete', () => {
		beforeEach(() => createPlayer({ inCreation: true }));

		it('should update the character data', () => {
			expect(player.data.inCreation).toBe(true);
			player.setCreationComplete();
			expect(player.data.inCreation).toBeUndefined();
		});

		it('should emit a change event', () => {
			expect(updateListener).not.toHaveBeenCalled();
			player.setCreationComplete();
			expect(updateListener).toHaveBeenCalledTimes(1);
			expect(updateListener).toHaveBeenCalledWith(MockPlayerData());
		});
	});

	function createPlayer(overrides?: Partial<ICharacterData>): void {
		player = new PlayerCharacter(MockPlayerData(overrides));
		onUpdateUnsubscribe = player.on('update', updateListener);
	}
});

describe('usePlayerData()', () => {
	it('should return null if player is null', () => {
		const { result } = renderHook(() => usePlayerData());
		expect(Player.value).toBeNull();
		expect(result.current).toBeNull();
	});
});

function MockPlayerData(overrides?: Partial<ICharacterData>): ICharacterData {
	return {
		id: 'c123',
		accountId: 0,
		name: 'mock',
		created: 0,
		accessId: 'mockID',
		settings: _.cloneDeep(CHARACTER_DEFAULT_PUBLIC_SETTINGS),
		...overrides,
	};
}
