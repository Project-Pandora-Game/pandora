import { SpaceDirectoryConfig } from 'pandora-common';

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
	bot: null,
};

export const TEST_SPACE: Readonly<SpaceDirectoryConfig> = {
	...TEST_SPACE_DEFAULTS,
	name: 'test',
	description: 'Some description',
	entryText: 'Some entry text',
	admin: [],
	banned: [2],
};

export const TEST_SPACE2: Readonly<SpaceDirectoryConfig> = {
	...TEST_SPACE_DEFAULTS,
	name: 'test2',
	description: 'Another description',
	entryText: 'More text to read',
	maxUsers: 7,
	admin: [],
	banned: [22, 13],
};

export const TEST_SPACE_DEV: Readonly<SpaceDirectoryConfig> = {
	...TEST_SPACE_DEFAULTS,
	name: 'test-dev',
	description: 'Development space',
	entryText: 'Upon entering you see the future of Pandora',
	admin: [],
	features: ['development'],
	development: {
	},
};
