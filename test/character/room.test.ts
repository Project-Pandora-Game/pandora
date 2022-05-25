import { ICharacterPublicData, IChatRoomClientData } from 'pandora-common';
import { Player, PlayerCharacter } from '../../src/character/player';
import { Room } from '../../src/character/room';

describe('Room', () => {
	// @ts-expect-error spy on private method
	const spyLeave = jest.spyOn(Room, 'onLeave')
		.mockImplementation(jest.fn());
	// @ts-expect-error spy on private method
	const spyUpdate = jest.spyOn(Room, 'updateCharacters')
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
			beforeAll(() => Player.value = true as unknown as PlayerCharacter);
			// cleanup
			afterAll(() => Player.value = null);

			it('should leave room when data is null', () => {

				expect(() => Room.update(null)).not.toThrowError();
				expect(spyLeave).toBeCalledTimes(1);
			});

			it('should leave room if data.id does not match', () => {
				Room.data.value = { id: 'c123' } as unknown as IChatRoomClientData;
				expect(() => Room.update({ id: 'c321' } as unknown as IChatRoomClientData))
					.not.toThrowError();
				expect(spyLeave).toBeCalledTimes(1);
				expect(spyUpdate).toBeCalledTimes(1);
			});

			it('should emit load event if id matches', () => {
				const load = jest.fn();
				Room.on('load', load);
				expect(() => Room.update({ id: 'c321' } as unknown as IChatRoomClientData))
					.not.toThrowError();
				expect(load).nthCalledWith(1, { id: 'c321' });
			});
		});

	});

	describe('getCharacterName()', () => {
		it('should return "[UNKNOWN]" when data is null', () => {
			Room.data.value = null;
			expect(Room.getCharacterName('c89892')).toBe('[UNKNOWN]');
		});

		it('should return "[UNKNOWN] when character is not found"', () => {
			Room.data.value = { characters: [] } as unknown as IChatRoomClientData;
			expect(Room.getCharacterName('c213129311')).toBe('[UNKNOWN]');
		});

		it('should should return character\'s name if found', () => {
			const char1: ICharacterPublicData = {
				id: 'c123',
				accountId: 0,
				name: 'test',
			};
			const char2: ICharacterPublicData = {
				id: 'c321',
				accountId: 0,
				name: 'tech',
			};
			Room.data.value = { characters: [char1, char2] } as unknown as IChatRoomClientData;
			expect(Room.getCharacterName('c123')).toBe('test');
			expect(Room.getCharacterName('c321')).toBe('tech');
		});
	});

	describe('getCharacterPronoun()', () => {
		it.todo('should return correct pronoun');
	});

});
