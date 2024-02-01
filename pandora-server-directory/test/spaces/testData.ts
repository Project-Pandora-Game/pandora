import { AccountId, CloneDeepMutable, DEFAULT_BACKGROUND, SpaceDirectoryConfig } from 'pandora-common';

const TEST_SPACE_DEFAULTS: Readonly<SpaceDirectoryConfig> = {
	name: '',
	description: '',
	maxUsers: 10,
	admin: [],
	banned: [],
	allow: [],
	public: true,
	password: null,
	features: [],
	background: CloneDeepMutable(DEFAULT_BACKGROUND),
};

export const TEST_SPACE: Readonly<SpaceDirectoryConfig> = {
	...TEST_SPACE_DEFAULTS,
	name: 'test',
	description: 'Some description',
	admin: [1],
	banned: [2],
};

export const TEST_SPACE2: Readonly<SpaceDirectoryConfig> = {
	...TEST_SPACE_DEFAULTS,
	name: 'test2',
	description: 'Another description',
	maxUsers: 7,
	password: 'abcd',
	admin: [2],
	banned: [22, 13],
};

export const TEST_SPACE_DEV: Readonly<SpaceDirectoryConfig> = {
	...TEST_SPACE_DEFAULTS,
	name: 'test-dev',
	description: 'Development space',
	admin: [1],
	features: ['development'],
	development: {
	},
};

export const TEST_SPACE_PANDORA_OWNED: readonly AccountId[] = [0];
