import { CreateObjectValidator, IsString, CreateArrayValidator, IsNumber, IsCharacterId, CreateMaybeValidator, IsUsername, CreateNullableValidator, NonNullable } from '../../validation';
import { IShardDirectoryArgument, ShardFeature } from '..';
import { IShardCharacterDefinition } from '../directory_shard';
import { IClientDirectoryAuthMessage } from '../client_directory';

/** TODO set this to true, we keep it false to make things simple in early development */
const SHARD_NO_EXTRA_OBJECT_KEY = false;
const CLIENT_NO_EXTRA_OBJECT_KEY = false;

export const IsIShardCharacterDefinition = CreateObjectValidator<IShardCharacterDefinition>({
	id: IsCharacterId,
	account: IsNumber,
	accessId: IsString,
	connectSecret: IsString,
}, SHARD_NO_EXTRA_OBJECT_KEY);

export const Shard = {
	shardRegister: CreateObjectValidator<IShardDirectoryArgument['shardRegister']>({
		shardId: CreateNullableValidator(IsString),
		publicURL: IsString,
		features: CreateArrayValidator<ShardFeature>({ validator: IsString }),
		version: IsString,
		characters: CreateArrayValidator<IShardDirectoryArgument['shardRegister']['characters'][0]>({
			validator: IsIShardCharacterDefinition,
		}),
	}, SHARD_NO_EXTRA_OBJECT_KEY),
	setCharacter: CreateObjectValidator<IShardDirectoryArgument['setCharacter']>({
		id: IsCharacterId,
		accessId: IsString,

		name: CreateMaybeValidator(IsString),
	}, SHARD_NO_EXTRA_OBJECT_KEY),
};

/**
 * Test if a given value
 */
export const IsClientDirectoryAuthMessage = CreateObjectValidator<IClientDirectoryAuthMessage>({
	username: IsUsername,
	token: IsString,
	character: CreateNullableValidator(CreateObjectValidator<NonNullable<IClientDirectoryAuthMessage['character']>>({
		id: IsCharacterId,
		secret: IsString,
	}, CLIENT_NO_EXTRA_OBJECT_KEY)),
}, CLIENT_NO_EXTRA_OBJECT_KEY);
