import type { IAccountRoleInfo } from '../account';
import type { AppearanceBundle } from '../assets';
import { CreateArrayValidator, CreateObjectValidator, CreateStringValidator } from '../validation';

export type CharacterId = `c${number}`;

/**
 * Test if a given value is a valid CharacterId - `'c{number}'`
 */
export const IsCharacterId = CreateStringValidator({
	regex: /^c[1-9][0-9]{0,15}$/,
}) as (str: unknown) => str is CharacterId;

export const IsCharacterIdArray = CreateArrayValidator<CharacterId>({ validator: IsCharacterId });

export type ICharacterPublicSettings = {
	labelColor: string;
};

export const CHARACTER_DEFAULT_PUBLIC_SETTINGS: Readonly<ICharacterPublicSettings> = {
	labelColor: '#ffffff',
};

export const IsCharacterPublicSettings = CreateObjectValidator<Partial<ICharacterPublicSettings>>({
	labelColor: CreateStringValidator({ regex: /^#[0-9a-f]{6}$/i }),
}, { partial: true });

export type ICharacterPublicData = {
	id: CharacterId;
	accountId: number;
	name: string;
	appearance?: AppearanceBundle;
	settings: ICharacterPublicSettings;
};

export type ICharacterData = ICharacterPublicData & {
	inCreation?: true;
	created: number;
	accessId: string;
	roles?: IAccountRoleInfo;
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
