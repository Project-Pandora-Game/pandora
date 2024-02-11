import { cloneDeep } from 'lodash';
import { nanoid } from 'nanoid';
import {
	ASSET_PREFERENCES_DEFAULT,
	AccountId,
	CHARACTER_DEFAULT_PUBLIC_SETTINGS,
	CharacterId,
	GenerateDefaultSpaceStateBundle,
	ICharacterData,
	IsNumber,
	SPACE_INVENTORY_BUNDLE_DEFAULT,
	SpaceData, SpaceDirectoryConfig,
	SpaceId,
} from 'pandora-common';
import type { DatabaseCharacterSelfInfo } from './databaseStructure';

export function CreateCharacter<Id extends number | CharacterId>(accountId: number, id: Id): [DatabaseCharacterSelfInfo, Omit<ICharacterData, 'id'> & { id: Id; }] {
	const infoId: CharacterId = IsNumber(id) ? `c${id}` as const : id;

	const info: DatabaseCharacterSelfInfo = {
		inCreation: true,
		id: infoId,
		name: '',
		preview: '',
		currentSpace: null,
	};

	const char: Omit<ICharacterData, 'id'> & { id: Id; } = {
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
		inventory: SPACE_INVENTORY_BUNDLE_DEFAULT,
		spaceState: GenerateDefaultSpaceStateBundle(),
		invites: [],
		...data,
	};
}
