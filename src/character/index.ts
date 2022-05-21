import { AppearanceBundle } from '../assets';
import type { AssetState, BoneStateCompressed } from '../assets';
import { CreateArrayValidator, CreateStringValidator } from '../validation';

export type CharacterId = `c${number}`;

/**
 * Test if a given value is a valid CharacterId - `'c{number}'`
 */
export const IsCharacterId = CreateStringValidator({
	regex: /^c[1-9][0-9]{0,15}$/,
}) as (str: unknown) => str is CharacterId;

export const IsCharacterIdArray = CreateArrayValidator<CharacterId>({ validator: IsCharacterId });

export type ICharacterPublicData = {
	id: CharacterId;
	accountId: number;
	name: string;
	appearance?: AppearanceBundle;
};

export type ICharacterData = ICharacterPublicData & {
	inCreation?: true;
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
