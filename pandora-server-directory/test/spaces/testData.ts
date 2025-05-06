import { AccountId, SpaceDirectoryConfig } from 'pandora-common';
import { ACTOR_PANDORA } from '../../src/account/actorPandora.ts';

const TEST_SPACE_DEFAULTS: Readonly<SpaceDirectoryConfig> = {
	name: '',
	description: '',
	entryText: '',
	maxUsers: 10,
	admin: [],
	banned: [],
	allow: [],
	public: 'public-with-admin',
	features: [],
	ghostManagement: null,
};

export const TEST_SPACE: Readonly<SpaceDirectoryConfig> = {
	...TEST_SPACE_DEFAULTS,
	name: 'test',
	description: 'Some description',
	entryText: 'Some entry text',
	admin: [1],
	banned: [2],
};

export const TEST_SPACE2: Readonly<SpaceDirectoryConfig> = {
	...TEST_SPACE_DEFAULTS,
	name: 'test2',
	description: 'Another description',
	entryText: 'More text to read',
	maxUsers: 7,
	admin: [2],
	banned: [22, 13],
};

export const TEST_SPACE_DEV: Readonly<SpaceDirectoryConfig> = {
	...TEST_SPACE_DEFAULTS,
	name: 'test-dev',
	description: 'Development space',
	entryText: 'Upon entering you see the future of Pandora',
	admin: [1],
	features: ['development'],
	development: {
	},
};

export const TEST_SPACE_PANDORA_OWNED: readonly AccountId[] = [ACTOR_PANDORA.id];
