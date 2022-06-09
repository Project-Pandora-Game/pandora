import { ICharacterData, ICharacterPublicData, IChatRoomClientData, CHARACTER_DEFAULT_PUBLIC_SETTINGS } from 'pandora-common';
import { Player, PlayerCharacter } from '../../src/character/player';
import { Room } from '../../src/character/room';
import _ from 'lodash';

const mockPlayerData: ICharacterData = {
	id: 'c123',
	accountId: 0,
	name: 'mock',
	created: 0,
	accessId: 'mockID',
	settings: _.cloneDeep(CHARACTER_DEFAULT_PUBLIC_SETTINGS),
};

describe('Room', () => {
	// @ts-expect-error spy on private method
	const spyLeave = jest.spyOn(Room, 'onLeave')
		.mockImplementation(jest.fn());

	afterAll(() => jest.restoreAllMocks());

	describe('loaded', () => {
		it('should return false when data is null', () => {
			expect(Room.data.value).toBeNull();
			expect(Room.loaded).toBe(false);
		});

		it('should return true when data is not null', () => {
			Room.data.value = { id: 'c123' } as unknown as IChatRoomClientData;
			expect(Room.loaded).toBe(true);
		});
	});
	describe('update()', () => {
		describe('When player is not loaded', () => {
			it('should throw error when player is not loaded', () => {
				expect(Player.value).toBeNull();
				expect(() => Room.update(null))
					.toThrowError();
			});
		});

		describe('When player is loaded', () => {
			// mock loaded player.
			beforeAll(() => Player.value = new PlayerCharacter(mockPlayerData));
			// cleanup
			afterAll(() => Player.value = null);

			it('should leave room when data is null', () => {

				Room.update(null);
				expect(spyLeave).toBeCalledTimes(1);
			});

			it('should leave room if data.id does not match', () => {
				Room.data.value = { id: 'c123' } as unknown as IChatRoomClientData;
				Room.update({ id: 'c321', characters: [] } as unknown as IChatRoomClientData);
				expect(spyLeave).toBeCalledTimes(1);
			});

			it('should emit load event if id matches', () => {
				const load = jest.fn();
				Room.on('load', load);
				Room.update({ id: 'c321', characters: [] } as unknown as IChatRoomClientData);
				expect(load).nthCalledWith(1, expect.objectContaining({ id: 'c321' }));
			});
		});

	});

	describe('getCharacterName()', () => {
		// mock loaded player.
		beforeAll(() => Player.value = new PlayerCharacter(mockPlayerData));
		// cleanup
		afterAll(() => Player.value = null);

		it('should return "[UNKNOWN]" when data is null', () => {
			Room.data.value = null;
			expect(Room.getCharacterName('c89892')).toBe('[UNKNOWN]');
		});

		it('should return "[UNKNOWN] when character is not found"', () => {
			Room.update({ id: 'c321', characters: [] } as unknown as IChatRoomClientData);
			expect(Room.getCharacterName('c213129311')).toBe('[UNKNOWN]');
		});

		it('should should return character\'s name if found', () => {
			const char1: ICharacterPublicData = {
				id: 'c123',
				accountId: 0,
				name: 'test',
				settings: _.cloneDeep(CHARACTER_DEFAULT_PUBLIC_SETTINGS),
			};
			const char2: ICharacterPublicData = {
				id: 'c321',
				accountId: 0,
				name: 'tech',
				settings: _.cloneDeep(CHARACTER_DEFAULT_PUBLIC_SETTINGS),
			};
			Room.update({ id: 'c321', characters: [char1, char2] } as unknown as IChatRoomClientData);
			expect(Room.getCharacterName('c123')).toBe('test');
			expect(Room.getCharacterName('c321')).toBe('tech');
		});
	});

	describe('getCharacterPronoun()', () => {
		it.todo('should return correct pronoun');
	});

});
