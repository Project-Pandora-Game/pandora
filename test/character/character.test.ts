import { Appearance, ICharacterData } from 'pandora-common';
import { Character, useCharacterAppearance, useCharacterData } from '../../src/character/character';
import { renderHook, act } from '@testing-library/react-hooks';

const mockData: ICharacterData = {
	id: 'c123',
	accountId: 0,
	name: 'mock',
	created: 0,
	accessId: 'mockID',
	bones: [],
	assets: [],
};
describe('Character', () => {
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

		it('should update appearance when passed in appearance', () => {
			const update: Partial<ICharacterData> = {
				id: 'c321',
				accessId: 'updatedId',
				appearance: {
					items: [],
				},
			};
			const mockImport = jest.spyOn(Appearance.prototype, 'importFromBundle');
			mock.update(update);
			expect(mock.data).toStrictEqual({ ...mockData, ...update });
			expect(mockImport).nthCalledWith(1, update.appearance, expect.anything());
		});
	});
});

describe('useCharacterData()', () => {
	let mock: Character;
	beforeEach(() => {
		mock = new Character(mockData);
	});
	it('should return character data', () => {
		const { result } = renderHook(() => useCharacterData(mock));
		expect(result.current).toStrictEqual(mock.data);
	});

	it('should update on character update event', () => {
		const { result } = renderHook(() => useCharacterData(mock));
		const update: Partial<ICharacterData> = {
			id: 'c321',
			accessId: 'updatedId',
		};
		act(() => {
			mock.update(update);
		});
		expect(result.current).toStrictEqual(mock.data);
	});
});

describe('useCharacterAppearance()', () => {
	let mock: Character;
	beforeEach(() => {
		mock = new Character(mockData);
	});
	it('should return character appearance', () => {
		const { result } = renderHook(() => useCharacterAppearance(mock));

		expect(result.current).toStrictEqual(mock.appearance);

	});
	it('should update on character update event', () => {
		const { result } = renderHook(() => useCharacterAppearance(mock));
		const update: Partial<ICharacterData> = {
			id: 'c321',
			accessId: 'updatedId',
			appearance: {
				items: [],
			},
		};
		act(() => {
			mock.update(update);
		});
		expect(result.current).toStrictEqual(mock.appearance);
	});
});
