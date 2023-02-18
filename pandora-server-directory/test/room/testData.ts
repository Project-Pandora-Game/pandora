import { AccountId, IChatRoomDirectoryConfig } from 'pandora-common';

const TEST_ROOM_DEFAULTS: Readonly<IChatRoomDirectoryConfig> = {
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

export const TEST_ROOM: Readonly<IChatRoomDirectoryConfig> = {
	...TEST_ROOM_DEFAULTS,
	name: 'test',
	description: 'Some description',
	admin: [1],
	banned: [2],
};

export const TEST_ROOM2: Readonly<IChatRoomDirectoryConfig> = {
	...TEST_ROOM_DEFAULTS,
	name: 'test2',
	description: 'Another description',
	maxUsers: 7,
	password: 'abcd',
	admin: [2],
	banned: [22, 13],
};

export const TEST_ROOM_DEV: Readonly<IChatRoomDirectoryConfig> = {
	...TEST_ROOM_DEFAULTS,
	name: 'test-dev',
	description: 'Development room',
	admin: [1],
	features: ['development'],
	development: {
	},
};

export const TEST_ROOM_PANDORA_OWNED: readonly AccountId[] = [0];
