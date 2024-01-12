import { AccountId, SpaceDirectoryConfig } from 'pandora-common';

const TEST_SPACE_DEFAULTS: Readonly<SpaceDirectoryConfig> = {
	name: '',
	description: '',
	maxUsers: 10,
	admin: [],
	banned: [],
	public: true,
	password: null,
	features: [],
	background: {
		image: '#1099bb',
		size: [1000, 1000],
		scaling: 0,
	},
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
