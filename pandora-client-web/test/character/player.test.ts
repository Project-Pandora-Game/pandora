import { cloneDeep } from 'lodash-es';
import { ASSET_PREFERENCES_DEFAULT, CharacterSize, ICharacterRoomData, type ICharacterPrivateData } from 'pandora-common';
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

	function createPlayer(overrides?: Partial<ICharacterPrivateData>): void {
		player = new PlayerCharacter(MockPlayerData(overrides));
		onUpdateUnsubscribe = player.on('update', updateListener);
	}
});

function MockPlayerData(overrides?: Partial<ICharacterPrivateData & ICharacterRoomData>): ICharacterPrivateData & ICharacterRoomData {
	return {
		id: 'c123',
		accountId: 0,
		accountDisplayName: 'mockPlayer',
		name: 'mock',
		profileDescription: 'A mock player',
		created: 0,
		settings: {},
		publicSettings: {},
		assetPreferences: cloneDeep(ASSET_PREFERENCES_DEFAULT),
		isOnline: true,
		...overrides,
	};
}
