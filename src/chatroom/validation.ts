import { IChatRoomBaseInfo, IChatRoomDirectoryConfig, IChatRoomFullInfo, RoomId } from './room';
import { ShardFeature, ShardFeatureList } from '../networking';
import { CreateArrayValidator, CreateMaybeValidator, CreateNullableValidator, CreateObjectValidator, CreateStringValidator, IsBoolean, IsNumber, IsString, ObjectValidatorConfig } from '../validation';

/**
 * Test if a given value is a valid RoomId - `'r{string}'`
 */
export const IsRoomId = CreateStringValidator({
	regex: /^r/,
}) as (str: unknown) => str is RoomId;

export const IsShardFeature = (val: unknown): val is ShardFeature => typeof val === 'string' && ShardFeatureList.includes(val as ShardFeature);

export const IsChatroomName = CreateStringValidator({
	regex: /^[a-zA-Z0-9_\- ]+$/,
	minLength: 3,
	maxLength: 32,
	trimCheck: true,
});

const IChatRoomBaseInfoValidatorConfig: ObjectValidatorConfig<IChatRoomBaseInfo> = {
	name: IsChatroomName,
	description: IsString,
	maxUsers: IsNumber,
	protected: IsBoolean,
};

export const IsIChatRoomBaseInfo = CreateObjectValidator<IChatRoomBaseInfo>(IChatRoomBaseInfoValidatorConfig);

const IChatRoomDirectoryConfigValidatorConfig: ObjectValidatorConfig<IChatRoomDirectoryConfig> = {
	...IChatRoomBaseInfoValidatorConfig,
	features: CreateArrayValidator<ShardFeature>({ validator: IsShardFeature }),
	development: CreateMaybeValidator(CreateObjectValidator({
		shardId: CreateMaybeValidator(IsString),
	}, { noExtraKey: true })),
	banned: CreateArrayValidator<number>({ validator: IsNumber }),
	admin: CreateArrayValidator<number>({ validator: IsNumber }),
	password: CreateNullableValidator(IsString),
};

export const IsIChatRoomDirectoryConfig = CreateObjectValidator<IChatRoomDirectoryConfig>(IChatRoomDirectoryConfigValidatorConfig);
export const IsPartialIChatRoomDirectoryConfig = CreateObjectValidator<IChatRoomDirectoryConfig>(IChatRoomDirectoryConfigValidatorConfig, { partial: true });

export const IsIChatRoomFullInfo = CreateObjectValidator<IChatRoomFullInfo>({
	...IChatRoomDirectoryConfigValidatorConfig,
	id: IsRoomId,
});
