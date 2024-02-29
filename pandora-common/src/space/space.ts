import { cloneDeep } from 'lodash';
import { z } from 'zod';
import { AccountId, AccountIdSchema } from '../account/account';
import { SPACE_INVENTORY_BUNDLE_DEFAULT, SpaceInventoryBundleSchema } from '../assets/state/spaceInventoryState';
import { CharacterId, CharacterIdSchema } from '../character/characterTypes';
import { LIMIT_SPACE_DESCRIPTION_LENGTH, LIMIT_SPACE_MAX_CHARACTER_NUMBER, LIMIT_SPACE_NAME_LENGTH, LIMIT_SPACE_NAME_PATTERN } from '../inputLimits';
import { ArrayToRecordKeys, CloneDeepMutable } from '../utility';
import { HexColorStringSchema, ZodArrayWithInvalidDrop, ZodTemplateString, ZodTrimedRegex } from '../validation';
import { DEFAULT_BACKGROUND, RoomBackgroundDataSchema } from './room';

// Fix for pnpm resolution weirdness
import type { } from '../assets/item/base';

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
	development: Readonly<SpaceDevelopmentConfig> | undefined;
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
	maxUsers: z.number().int().min(1).max(LIMIT_SPACE_MAX_CHARACTER_NUMBER).catch(10),
});
export type SpaceBaseInfo = z.infer<typeof SpaceBaseInfoSchema>;

export const SpaceInviteIdSchema = ZodTemplateString<`i_${string}`>(z.string(), /^i_/);
export type SpaceInviteId = z.infer<typeof SpaceInviteIdSchema>;
export const SpaceInviteSchema = z.object({
	/** Unique id of the invite */
	id: SpaceInviteIdSchema,
	/** The amount of times the invite has been used */
	uses: z.number().int(),
	/** Max uses of the invite */
	maxUses: z.number().int().optional(),
	/** Account that this invite limited to */
	accountId: AccountIdSchema.optional(),
	/** Character that this invite limited to */
	characterId: CharacterIdSchema.optional(),
	/** The time when the invite expires */
	expires: z.number().int().optional(),
	/** Type of the invite */
	type: z.enum(['joinMe', 'spaceBound']),
	/** Creator of the invite */
	createdBy: z.object({
		accountId: AccountIdSchema,
		characterId: CharacterIdSchema,
	}),
});
export type SpaceInvite = z.infer<typeof SpaceInviteSchema>;
export const SpaceInviteCreateSchema = SpaceInviteSchema.omit({ id: true, uses: true, createdBy: true });
export type SpaceInviteCreate = z.infer<typeof SpaceInviteCreateSchema>;

export const SpaceDevelopmentConfigSchema = z.object({
	/** The id of the shard that the room will be created on */
	shardId: z.string().optional(),
	/** Automatically grants admin to every developer on enter */
	autoAdmin: z.boolean().optional(),
	/** Disable safemode cooldown for everyone inside the space */
	disableSafemodeCooldown: z.boolean().optional(),
});
export type SpaceDevelopmentConfig = z.infer<typeof SpaceDevelopmentConfigSchema>;

export const SpaceDirectoryConfigSchema = SpaceBaseInfoSchema.extend({
	/** The requested features */
	features: z.array(SpaceFeatureSchema).max(SpaceFeatureSchema.options.length),
	/**
	 * Development options, may get ignored if requested features don't include 'development'
	 */
	development: SpaceDevelopmentConfigSchema.optional(),
	/** The banned account ids */
	banned: AccountIdSchema.array(),
	/** The admin account ids */
	admin: AccountIdSchema.array(),
	/** Account ids that always allow to enter */
	allow: AccountIdSchema.array().default([]),
	/** The ID of the background or custom data */
	background: z.union([z.string(), RoomBackgroundDataSchema.extend({ image: HexColorStringSchema.catch('#1099bb') })]).catch(CloneDeepMutable(DEFAULT_BACKGROUND)),
});
export type SpaceDirectoryConfig = z.infer<typeof SpaceDirectoryConfigSchema>;

export const SpaceDirectoryUpdateSchema = SpaceDirectoryConfigSchema.omit({ features: true, development: true }).partial();
export type SpaceDirectoryUpdate = z.infer<typeof SpaceDirectoryUpdateSchema>;

/** Info sent to client when searching for a space */
export type SpaceListInfo = SpaceBaseInfo & {
	/** The id of the space, never changes */
	id: SpaceId;
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
	isAllowed: boolean;
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
	inventory: SpaceInventoryBundleSchema.default(() => cloneDeep(SPACE_INVENTORY_BUNDLE_DEFAULT)),
	invites: ZodArrayWithInvalidDrop(SpaceInviteSchema, z.record(z.unknown())).default([]),
});
/** Space data stored in database */
export type SpaceData = z.infer<typeof SpaceDataSchema>;

export const SPACE_DIRECTORY_UPDATEABLE_PROPERTIES = ['config', 'owners', 'invites'] as const satisfies readonly (keyof SpaceData)[];
export const SpaceDataDirectoryUpdateSchema = SpaceDataSchema.pick(ArrayToRecordKeys(SPACE_DIRECTORY_UPDATEABLE_PROPERTIES, true)).partial();
export type SpaceDataDirectoryUpdate = z.infer<typeof SpaceDataDirectoryUpdateSchema>;

export const SPACE_SHARD_UPDATEABLE_PROPERTIES = ['inventory'] as const satisfies readonly Exclude<keyof SpaceData, ((typeof SPACE_DIRECTORY_PROPERTIES)[number])>[];
export const SpaceDataShardUpdateSchema = SpaceDataSchema.pick(ArrayToRecordKeys(SPACE_SHARD_UPDATEABLE_PROPERTIES, true)).partial();
export type SpaceDataShardUpdate = z.infer<typeof SpaceDataShardUpdateSchema>;

export const SPACE_DIRECTORY_PROPERTIES = ['id', 'config', 'owners', 'accessId', 'invites'] as const satisfies readonly (keyof SpaceData)[];
/** Space data from database, only those relevant to Directory */
export const SpaceDirectoryDataSchema = SpaceDataSchema.pick(ArrayToRecordKeys(SPACE_DIRECTORY_PROPERTIES, true));
/** Space data from database, only those relevant to Directory */
export type SpaceDirectoryData = z.infer<typeof SpaceDirectoryDataSchema>;

/** Reason for why a character left (was removed from) a space */
export type SpaceLeaveReason = 'leave' | 'disconnect' | 'destroy' | 'error' | 'kick' | 'ban';
