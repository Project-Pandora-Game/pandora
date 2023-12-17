import { AccountId, CharacterId, CHARACTER_DEFAULT_PUBLIC_SETTINGS, ICharacterData, IChatRoomData, IChatRoomDirectoryConfig, IsNumber, RoomId, ROOM_INVENTORY_BUNDLE_DEFAULT, ASSET_PREFERENCES_DEFAULT } from 'pandora-common';
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
		preferences: cloneDeep(ASSET_PREFERENCES_DEFAULT),
		position: [-1, -1, 0],
	};

	return [info, char];
}

export interface IChatRoomCreationData {
	config: IChatRoomDirectoryConfig;
	owners: AccountId[];
}

export function CreateChatRoom(data: IChatRoomCreationData, id?: RoomId): IChatRoomData {
	return {
		id: id ?? `r/${nanoid()}`,
		accessId: '',
		inventory: ROOM_INVENTORY_BUNDLE_DEFAULT,
		...data,
	};
}
