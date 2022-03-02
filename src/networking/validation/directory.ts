import { CreateObjectValidator, IsString, CreateArrayValidator, IsNumber, IsCharacterId, CreateMaybeValidator } from '../../validation';
import { IShardDirectoryArgument, ShardFeature } from '..';

/** TODO set this to true, we keep it false to make things simple in early development */
const SHARD_NO_EXTRA_OBJECT_KEY = false;

export const Shard = {
	sendInfo: CreateObjectValidator<IShardDirectoryArgument['sendInfo']>({
		publicURL: IsString,
		features: CreateArrayValidator<ShardFeature>({ validator: IsString }),
		version: IsString,
		characters: CreateArrayValidator<IShardDirectoryArgument['sendInfo']['characters'][0]>({
			validator: CreateObjectValidator<IShardDirectoryArgument['sendInfo']['characters'][0]>({
				accountId: IsNumber,
				characterId: IsCharacterId,
				accessId: IsString,
			}, SHARD_NO_EXTRA_OBJECT_KEY),
		}),
	}, SHARD_NO_EXTRA_OBJECT_KEY),
	setCharacter: CreateObjectValidator<IShardDirectoryArgument['setCharacter']>({
		id: IsCharacterId,
		accessId: IsString,

		name: CreateMaybeValidator(IsString),
	}, SHARD_NO_EXTRA_OBJECT_KEY),
};
