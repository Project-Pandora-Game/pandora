import { IDirectoryCharacterConnectionInfo } from 'pandora-common';

export function MockConnectionInfo(overrides?: Partial<IDirectoryCharacterConnectionInfo>): IDirectoryCharacterConnectionInfo {
	return {
		id: '5099803df3f4948bd2f98391',
		publicURL: 'http://shard-url:12345',
		features: [],
		version: '0.0.0',
		characterId: 'c123',
		secret: 'uXFqcVOH',
		...overrides,
	};
}
