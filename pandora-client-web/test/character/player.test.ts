import _ from 'lodash';
import { CHARACTER_DEFAULT_PUBLIC_SETTINGS, ICharacterData, ICharacterRoomData, CharacterSize, ASSET_PREFERENCES_DEFAULT } from 'pandora-common';
import { PlayerCharacter } from '../../src/character/player';

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

function MockPlayerData(overrides?: Partial<ICharacterData & ICharacterRoomData>): ICharacterData & ICharacterRoomData {
	return {
		id: 'c123',
		accountId: 0,
		name: 'mock',
		profileDescription: 'A mock player',
		created: 0,
		accessId: 'mockID',
		settings: _.cloneDeep(CHARACTER_DEFAULT_PUBLIC_SETTINGS),
		assetPreferences: _.cloneDeep(ASSET_PREFERENCES_DEFAULT),
		position: [CharacterSize.WIDTH / 2, 0, 0],
		isOnline: true,
		...overrides,
	};
}
