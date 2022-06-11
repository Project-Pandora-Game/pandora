import { renderHook } from '@testing-library/react';
import _ from 'lodash';
import { CHARACTER_DEFAULT_PUBLIC_SETTINGS, ICharacterData } from 'pandora-common';
import { Player, PlayerCharacter, usePlayerData } from '../../src/character/player';
import { ShardConnector } from '../../src/networking/socketio_shard_connector';

const mockData: ICharacterData = {
	id: 'c123',
	accountId: 0,
	name: 'mock',
	created: 0,
	accessId: 'mockID',
	settings: _.cloneDeep(CHARACTER_DEFAULT_PUBLIC_SETTINGS),
};
describe('PlayerCharacter', () => {
	let mock: PlayerCharacter;
	beforeEach(() => {
		mock = new PlayerCharacter(mockData);
	});

	describe('finishCreation()', () => {
		it('should return "failed" if no connection to shard', async () => {
			const ret = await mock.finishCreation('test');
			expect(ShardConnector.value).toBeNull();
			expect(ret).toBe('failed');
		});
	});
});

describe('usePlayerData()', () => {
	it('should return null if player is null', () => {
		const { result } = renderHook(() => usePlayerData());
		expect(Player.value).toBeNull();
		expect(result.current).toBeNull();
	});
});
