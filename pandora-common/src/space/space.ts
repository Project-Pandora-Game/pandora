import { z } from 'zod';
import { ZodTrimedRegex, ZodTemplateString, HexColorStringSchema } from '../validation';
import { cloneDeep } from 'lodash';
import { ROOM_INVENTORY_BUNDLE_DEFAULT } from '../assets';
import { CharacterId } from '../character';
import { AccountId, AccountIdSchema } from '../account/account';
import { RoomInventoryBundleSchema } from '../assets/state/roomState';
import { ArrayToRecordKeys } from '../utility';
import { LIMIT_SPACE_DESCRIPTION_LENGTH, LIMIT_SPACE_NAME_LENGTH, LIMIT_SPACE_NAME_PATTERN } from '../inputLimits';

// Fix for pnpm resolution weirdness
import type { } from '../assets/item';
import { RoomBackgroundDataSchema } from './room';

export const ShardFeatureSchema = z.enum(['development']);
export type ShardFeature = z.infer<typeof ShardFeatureSchema>;

// TODO(spaces): Consider updating this pattern to reflect that it is now called a "space"
export const SpaceIdSchema = ZodTemplateString<`r/${string}`>(z.string(), /^r\//);
export type SpaceId = z.infer<typeof SpaceIdSchema>;

export const SpaceFeatureSchema = z.enum([
	// Allows characters inside to change their body
	'allowBodyChanges',
	// Allows characters inside to change their pronouns
	'allowPronounChanges',
	// Enables development options for the space
	'development',
]);
export type SpaceFeature = z.infer<typeof SpaceFeatureSchema>;

export type ActionSpaceContext = {
	features: readonly SpaceFeature[];
	isAdmin(account: AccountId): boolean;
};

export const SpaceBaseInfoSchema = z.object({
	/** The name of the space */
	name: z.string().min(3).max(LIMIT_SPACE_NAME_LENGTH).regex(LIMIT_SPACE_NAME_PATTERN).regex(ZodTrimedRegex),
	/** The description of the space */
	description: z.string().max(LIMIT_SPACE_DESCRIPTION_LENGTH),
	/** Spaces are private by default and can be published to be seen in public space search. */
	public: z.boolean(),
	/** The maximum amount of characters that can be present at once in the space */
	maxUsers: z.number().min(1),
});
export type SpaceBaseInfo = z.infer<typeof SpaceBaseInfoSchema>;

export const SpaceDirectoryConfigSchema = SpaceBaseInfoSchema.extend({
	/** The requested features */
	features: z.array(SpaceFeatureSchema).max(SpaceFeatureSchema.options.length),
	/**
	 * Development options, may get ignored if requested features don't include 'development'
	 */
	development: z.object({
		/** The id of the shard that the room will be created on */
		shardId: z.string().optional(),
		/** Automatically grants admin to every developer on enter */
		autoAdmin: z.boolean().optional(),
	}).optional(),
	/** The banned account ids */
	banned: z.array(z.number()),
	/** The admin account ids */
	admin: z.array(z.number()),
	/** The password of the chat room if the room is protected */
	password: z.string().nullable(),
	/** The ID of the background or custom data */
	background: z.union([z.string(), RoomBackgroundDataSchema.extend({ image: HexColorStringSchema.catch('#1099bb') })]),
});
export type SpaceDirectoryConfig = z.infer<typeof SpaceDirectoryConfigSchema>;

export const SpaceDirectoryUpdateSchema = SpaceDirectoryConfigSchema.omit({ features: true, development: true }).partial();
export type SpaceDirectoryUpdate = z.infer<typeof SpaceDirectoryUpdateSchema>;

/** Info sent to client when searching for a space */
export type SpaceListInfo = SpaceBaseInfo & {
	/** The id of the space, never changes */
	id: SpaceId;
	/** Indicated if a password is required */
	hasPassword: boolean;
	/** The amount of online characters in the space */
	onlineCharacters: number;
	/** The amount of characters in the space (both online and offline) */
	totalCharacters: number;
	/** Whether the account that requested the info is owner of this room */
	isOwner: boolean;
};

/** Info sent to client when displaying details about a space */
export type SpaceListExtendedInfo = SpaceListInfo & Pick<SpaceDirectoryConfig, 'features' | 'admin' | 'background'> & {
	// Note: `isAdmin` is not part of the basic info (`SpaceListInfo`), as it has more complex check than `isOwner` and shouldn't be done en masse
	/** Whether the account that requested the info is admin of this space */
	isAdmin: boolean;
	owners: AccountId[];
	characters: {
		id: CharacterId;
		accountId: number;
		name: string;
		isOnline: boolean;
	}[];
};

export const SpaceClientInfoSchema = SpaceDirectoryConfigSchema.extend({
	/** Account IDs of accounts owning this space */
	owners: AccountIdSchema.array(),
});
export type SpaceClientInfo = z.infer<typeof SpaceClientInfoSchema>;

/** Space data stored in database */
export const SpaceDataSchema = z.object({
	id: SpaceIdSchema,
	accessId: z.string(),
	/** Account IDs of accounts owning this space */
	owners: AccountIdSchema.array(),
	config: SpaceDirectoryConfigSchema,
	inventory: RoomInventoryBundleSchema.default(() => cloneDeep(ROOM_INVENTORY_BUNDLE_DEFAULT)),
});
/** Space data stored in database */
export type SpaceData = z.infer<typeof SpaceDataSchema>;

export const SPACE_DIRECTORY_UPDATEABLE_PROPERTIES = ['config', 'owners'] as const satisfies readonly (keyof SpaceData)[];
export const SpaceDataDirectoryUpdateSchema = SpaceDataSchema.pick(ArrayToRecordKeys(SPACE_DIRECTORY_UPDATEABLE_PROPERTIES, true)).partial();
export type SpaceDataDirectoryUpdate = z.infer<typeof SpaceDataDirectoryUpdateSchema>;

export const SPACE_SHARD_UPDATEABLE_PROPERTIES = ['inventory'] as const satisfies readonly Exclude<keyof SpaceData, ((typeof SPACE_DIRECTORY_PROPERTIES)[number])>[];
export const SpaceDataShardUpdateSchema = SpaceDataSchema.pick(ArrayToRecordKeys(SPACE_SHARD_UPDATEABLE_PROPERTIES, true)).partial();
export type SpaceDataShardUpdate = z.infer<typeof SpaceDataShardUpdateSchema>;

export const SPACE_DIRECTORY_PROPERTIES = ['id', 'config', 'owners', 'accessId'] as const satisfies readonly (keyof SpaceData)[];
/** Space data from database, only those relevant to Directory */
export const SpaceDirectoryDataSchema = SpaceDataSchema.pick(ArrayToRecordKeys(SPACE_DIRECTORY_PROPERTIES, true));
/** Space data from database, only those relevant to Directory */
export type SpaceDirectoryData = z.infer<typeof SpaceDirectoryDataSchema>;

/** Reason for why a character left (was removed from) a space */
export type SpaceLeaveReason = 'leave' | 'disconnect' | 'destroy' | 'error' | 'kick' | 'ban';
