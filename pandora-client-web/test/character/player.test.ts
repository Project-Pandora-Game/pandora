import { cloneDeep } from 'lodash-es';
import { ASSET_PREFERENCES_DEFAULT, CHARACTER_DEFAULT_PUBLIC_SETTINGS, CharacterSize, ICharacterData, ICharacterRoomData } from 'pandora-common';
import { PlayerCharacter } from '../../src/character/player.ts';
const jest = import.meta.jest; // Jest is not properly injected in ESM

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
		preview: '',
		currentSpace: null,
		created: 0,
		accessId: 'mockID',
		settings: cloneDeep(CHARACTER_DEFAULT_PUBLIC_SETTINGS),
		assetPreferences: cloneDeep(ASSET_PREFERENCES_DEFAULT),
		position: [CharacterSize.WIDTH / 2, 0, 0],
		isOnline: true,
		...overrides,
	};
}
