import { cloneDeep } from 'lodash-es';
import { nanoid } from 'nanoid';
import {
	ASSET_PREFERENCES_DEFAULT,
	AccountId,
	CHARACTER_DEFAULT_PUBLIC_SETTINGS,
	CharacterId,
	ICharacterData,
	ROOM_INVENTORY_BUNDLE_DEFAULT,
	SpaceData,
	SpaceDirectoryConfig,
	SpaceId,
} from 'pandora-common';
import type { DatabaseCharacterSelfInfo } from './databaseStructure.ts';

export function CreateCharacter(accountId: number, id: CharacterId): [DatabaseCharacterSelfInfo, ICharacterData] {
	const info: DatabaseCharacterSelfInfo = {
		inCreation: true,
		id,
		name: '',
		preview: '',
		currentSpace: null,
	};

	const char: ICharacterData = {
		inCreation: true,
		id,
		accountId,
		name: info.name,
		preview: '',
		currentSpace: null,
		profileDescription: '',
		created: -1,
		accessId: nanoid(8),
		settings: cloneDeep(CHARACTER_DEFAULT_PUBLIC_SETTINGS),
		assetPreferences: cloneDeep(ASSET_PREFERENCES_DEFAULT),
		position: [-1, -1, 0],
	};

	return [info, char];
}

export interface SpaceCreationData {
	config: SpaceDirectoryConfig;
	owners: AccountId[];
}

export function CreateSpace(data: SpaceCreationData, id?: SpaceId): SpaceData {
	return {
		id: id ?? `s/${nanoid()}`,
		accessId: '',
		inventory: ROOM_INVENTORY_BUNDLE_DEFAULT,
		invites: [],
		...data,
	};
}
