import { ICharacterData } from 'pandora-common';
import { Character } from '../../src/character/character';

describe('Character', () => {
	const mockData: ICharacterData = {
		id: 'c123',
		accountId: 0,
		name: 'mock',
		created: 0,
		accessId: 'mockID',
		bones: [],
		assets: [],
	};
	let mock: Character;
	beforeEach(() => {
		mock = new Character(mockData);
	});
	describe('constructor', () => {
		it('should save character data', () => {
			expect(mock.data).toStrictEqual(mockData);
		});
	});
	describe('update()', () => {
		it('should partially update Character.data object', () => {
			const update: Partial<ICharacterData> = {
				id: 'c321',
				accessId: 'updatedId',
			};
			mock.update(update);
			expect(mock.data).toStrictEqual({ ...mockData, ...update });
		});
	});
});
