import type { AssetState, BoneStateCompressed } from './asset/state';

export type CharacterId = `c${number}`;

export type ICharacterData = {
	inCreation?: true;
	id: CharacterId;
	accountId: number;
	name: string;
	created: number;
	accessId: string;
	bones: BoneStateCompressed[],
	assets: AssetState[],
};

export type ICharacterDataCreate = Pick<ICharacterData, 'name'>;
export type ICharacterDataAccess = Pick<ICharacterData, 'id' | 'accessId'>;
export type ICharacterDataUpdate = Partial<Omit<ICharacterData, 'inCreation' | 'accountId' | 'created'>> & ICharacterDataAccess;
export type ICharacterDataId = Pick<ICharacterData, 'id'>;

export type ICharacterSelfInfo = {
	id: CharacterId;
	name: string;
	preview: string;
	state: string;
	inCreation?: true;
};

export type ICharacterSelfInfoUpdate = Pick<ICharacterSelfInfo, 'id'> & Partial<Pick<ICharacterSelfInfo, 'preview'>>;
