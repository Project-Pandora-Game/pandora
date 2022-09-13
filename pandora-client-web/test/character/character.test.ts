import { act, renderHook } from '@testing-library/react';
import { cloneDeep } from 'lodash';
import {
	Appearance,
	APPEARANCE_BUNDLE_DEFAULT,
	CHARACTER_DEFAULT_PUBLIC_SETTINGS,
	ICharacterData,
} from 'pandora-common';
import {
	Character,
	useCharacterAppearanceItems,
	useCharacterAppearancePose,
	useCharacterData,
} from '../../src/character/character';

const mockData: ICharacterData = {
	id: 'c123',
	accountId: 0,
	name: 'mock',
	created: 0,
	accessId: 'mockID',
	settings: cloneDeep(CHARACTER_DEFAULT_PUBLIC_SETTINGS),
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
				appearance: cloneDeep(APPEARANCE_BUNDLE_DEFAULT),
			};
			const mockImport = jest.spyOn(Appearance.prototype, 'importFromBundle');
			mock.update(update);
			expect(mock.data).toStrictEqual({ ...mockData, ...update });
			expect(mockImport).nthCalledWith(1, update.appearance, expect.anything(), expect.anything());
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

describe('useCharacterAppearanceItems()', () => {
	let mock: Character;
	beforeEach(() => {
		mock = new Character(mockData);
	});
	it('should return character appearance', () => {
		const { result } = renderHook(() => useCharacterAppearanceItems(mock));

		expect(result.current).toBe(mock.appearance.getAllItems());

	});
	it('should update on character update event', () => {
		const { result } = renderHook(() => useCharacterAppearanceItems(mock));
		const update: Partial<ICharacterData> = {
			id: 'c321',
			accessId: 'updatedId',
			appearance: cloneDeep(APPEARANCE_BUNDLE_DEFAULT),
		};
		act(() => {
			mock.update(update);
		});
		expect(result.current).toBe(mock.appearance.getAllItems());
	});
});

describe('useCharacterAppearancePose()', () => {
	let mock: Character;
	beforeEach(() => {
		mock = new Character(mockData);
	});
	it('should return character appearance', () => {
		const { result } = renderHook(() => useCharacterAppearancePose(mock));

		expect(result.current).toBe(mock.appearance.getFullPose());

	});
	it('should update on character update event', () => {
		const { result } = renderHook(() => useCharacterAppearancePose(mock));
		const update: Partial<ICharacterData> = {
			id: 'c321',
			accessId: 'updatedId',
			appearance: cloneDeep(APPEARANCE_BUNDLE_DEFAULT),
		};
		act(() => {
			mock.update(update);
		});
		expect(result.current).toBe(mock.appearance.getFullPose());
	});
});
