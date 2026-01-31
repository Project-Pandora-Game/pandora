import type { ClientGameLogicServicesConnectionInfo } from '../../../src/services/clientGameLogicServices.ts';

export function MockConnectionInfo(overrides?: Partial<ClientGameLogicServicesConnectionInfo>): ClientGameLogicServicesConnectionInfo {
	return {
		characterId: 'c123',
		shardConnection: {
			id: '5099803df3f4948bd2f98391',
			publicURL: 'http://shard-url:12345',
			features: [],
			version: '0.0.0',
			secret: 'uXFqcVOH',
		},
		...overrides,
	};
}
