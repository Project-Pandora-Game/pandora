import { renderHook } from '@testing-library/react';
import { cloneDeep } from 'lodash-es';
import {
	ASSET_PREFERENCES_DEFAULT,
	CHARACTER_DEFAULT_PUBLIC_SETTINGS,
	ICharacterData,
	ICharacterRoomData,
} from 'pandora-common';
import { act } from 'react';
import {
	Character,
	useCharacterData,
} from '../../src/character/character.ts';

const mockData: ICharacterRoomData = {
	id: 'c123',
	accountId: 0,
	name: 'mock',
	profileDescription: 'A mock character',
	settings: cloneDeep(CHARACTER_DEFAULT_PUBLIC_SETTINGS),
	assetPreferences: cloneDeep(ASSET_PREFERENCES_DEFAULT),
	position: [0, 0, 0],
	isOnline: true,
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
