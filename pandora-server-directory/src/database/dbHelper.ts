import { AccountId, CharacterId, CHARACTER_DEFAULT_PUBLIC_SETTINGS, ICharacterData, SpaceData, SpaceDirectoryConfig, IsNumber, SpaceId, ROOM_INVENTORY_BUNDLE_DEFAULT, ASSET_PREFERENCES_DEFAULT } from 'pandora-common';
import type { ICharacterSelfInfoDb } from './databaseProvider';

import { cloneDeep } from 'lodash';
import { nanoid } from 'nanoid';

export function CreateCharacter<Id extends number | CharacterId>(accountId: number, id: Id): [ICharacterSelfInfoDb, Omit<ICharacterData, 'id'> & { id: Id; }] {
	const infoId: CharacterId = IsNumber(id) ? `c${id}` as const : id;

	const info: ICharacterSelfInfoDb = {
		inCreation: true,
		id: infoId,
		name: '',
		preview: '',
	};

	const char: Omit<ICharacterData, 'id'> & { id: Id; } = {
		inCreation: true,
		id,
		accountId,
		name: info.name,
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
		id: id ?? `r/${nanoid()}`,
		accessId: '',
		inventory: ROOM_INVENTORY_BUNDLE_DEFAULT,
		invites: [],
		...data,
	};
}
