import { CharacterId, CHARACTER_DEFAULT_PUBLIC_SETTINGS, ICharacterData, IsNumber } from 'pandora-common';
import type { ICharacterSelfInfoDb } from './databaseProvider';

import { cloneDeep } from 'lodash';
import { nanoid } from 'nanoid';

export function CreateCharacter<Id extends number | CharacterId>(accountId: number, id: Id): [ICharacterSelfInfoDb, Omit<ICharacterData, 'id'> & { id: Id; }] {
	const infoId: CharacterId = IsNumber(id) ? `c${id}` : id;

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
		created: -1,
		accessId: nanoid(8),
		settings: cloneDeep(CHARACTER_DEFAULT_PUBLIC_SETTINGS),
	};

	return [info, char];
}
