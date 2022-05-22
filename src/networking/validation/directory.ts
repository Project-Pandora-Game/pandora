import { CreateObjectValidator, IsString, CreateArrayValidator, CreateMaybeValidator, IsUsername, CreateNullableValidator, NonNullable } from '../../validation';
import type { IShardDirectoryArgument, ShardFeature } from '../shard_directory';
import { IsIShardCharacterDefinition } from '../directory_shard';
import type { IClientDirectoryAuthMessage } from '../client_directory';
import { IChatRoomFullInfo, IsIChatRoomFullInfo, IsShardFeature } from '../../chatroom';
import { CharacterId, IsCharacterId } from '../../character';

/** TODO set this to true, we keep it false to make things simple in early development */
const SHARD_NO_EXTRA_OBJECT_KEY = false;
const CLIENT_NO_EXTRA_OBJECT_KEY = false;

export const Shard = {
	shardRegister: CreateObjectValidator<IShardDirectoryArgument['shardRegister']>({
		shardId: CreateNullableValidator(IsString),
		publicURL: IsString,
		features: CreateArrayValidator<ShardFeature>({ validator: IsShardFeature }),
		version: IsString,
		characters: CreateArrayValidator<IShardDirectoryArgument['shardRegister']['characters'][0]>({
			validator: IsIShardCharacterDefinition,
		}),
		disconnectCharacters: CreateArrayValidator<CharacterId>({ validator: IsCharacterId }),
		rooms: CreateArrayValidator<IChatRoomFullInfo>({ validator: IsIChatRoomFullInfo }),
	}, { noExtraKey: SHARD_NO_EXTRA_OBJECT_KEY }),
	setCharacter: CreateObjectValidator<IShardDirectoryArgument['setCharacter']>({
		id: IsCharacterId,
		accessId: IsString,

		name: CreateMaybeValidator(IsString),
	}, { noExtraKey: SHARD_NO_EXTRA_OBJECT_KEY }),
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
	}, { noExtraKey: CLIENT_NO_EXTRA_OBJECT_KEY })),
}, { noExtraKey: CLIENT_NO_EXTRA_OBJECT_KEY });
