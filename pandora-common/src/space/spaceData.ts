import * as z from 'zod';
import { AccountIdSchema } from '../account/account.ts';
import { SPACE_STATE_BUNDLE_DEFAULT_PUBLIC_SPACE, SpaceStateBundleSchema } from '../assets/state/spaceState.ts';
import { CharacterIdSchema } from '../character/characterTypes.ts';
import { LIMIT_SPACE_DESCRIPTION_LENGTH, LIMIT_SPACE_ENTRYTEXT_LENGTH, LIMIT_SPACE_MAX_CHARACTER_NUMBER } from '../inputLimits.ts';
import { ArrayToRecordKeys, CloneDeepMutable } from '../utility/misc.ts';
import { ZodArrayWithInvalidDrop } from '../validation.ts';
import { SPACE_ACTIVITY_DATA_DEFAULT, SpaceActivitySavedDataSchema } from './activity.ts';
import { SpaceFeatureSchema, SpaceIdSchema, SpaceInviteIdSchema, SpaceNameSchema, SpacePublicSettingSchema } from './space.ts';
import { SpaceSwitchClientStatusSchema } from './spaceSwitch.ts';

export const SpaceBaseInfoSchema = z.object({
	/** The name of the space */
	name: SpaceNameSchema,
	/** The description of the space */
	description: z.string().max(LIMIT_SPACE_DESCRIPTION_LENGTH),
	/**
	 * Whether the space is private or public (under some conditions)
	 * @see SpacePublicSettingSchema
	 */
	public: SpacePublicSettingSchema,
	/** The maximum amount of characters that can be present at once in the space */
	maxUsers: z.number().int().min(1).max(LIMIT_SPACE_MAX_CHARACTER_NUMBER).catch(10),
});
export type SpaceBaseInfo = z.infer<typeof SpaceBaseInfoSchema>;

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

export const SpaceGhostManagementConfigSchema = z.object({
	/**
	 * Which characters to exclude from automatic ghost management.
	 * - `none` = applies to all characters
	 * - `owner` = Owners are excluded
	 * - `admin` = Owners and admins are excluded
	 * - `allowed` = Owners, admins, and people on the "allowed users" list are excluded
	 */
	ignore: z.enum(['none', 'owner', 'admin', 'allowed']),
	/**
	 * Time to kick ghost characters in minutes.
	 * This timer might reset itself seemingly sporadically.
	 */
	timer: z.number().nonnegative(),
	/**
	 * Whether the mechanism should affect characters that are in room devices or not.
	 */
	affectCharactersInRoomDevice: z.boolean().catch(false),
});

export type SpaceGhostManagementConfig = z.infer<typeof SpaceGhostManagementConfigSchema>;

export const SpaceDirectoryConfigSchema = SpaceBaseInfoSchema.extend({
	/** The requested features */
	features: ZodArrayWithInvalidDrop(SpaceFeatureSchema, z.string(), SpaceFeatureSchema.options.length),
	/**
	 * Development options, may get ignored if requested features don't include 'development'
	 */
	development: SpaceDevelopmentConfigSchema.optional(),
	/** The entry text of the space, shown to players when they enter */
	entryText: z.string().max(LIMIT_SPACE_ENTRYTEXT_LENGTH).catch(''),
	/** The banned account ids */
	banned: AccountIdSchema.array(),
	/** The admin account ids */
	admin: AccountIdSchema.array(),
	/** Account ids that always allow to enter */
	allow: AccountIdSchema.array().catch(() => []),
	/** Automatic space ghost management settings. `null` if disabled completely. */
	ghostManagement: SpaceGhostManagementConfigSchema.nullable().catch(null),
});
export type SpaceDirectoryConfig = z.infer<typeof SpaceDirectoryConfigSchema>;

export const SpaceDirectoryUpdateSchema = SpaceDirectoryConfigSchema.omit({ features: true }).partial();
export type SpaceDirectoryUpdate = z.infer<typeof SpaceDirectoryUpdateSchema>;

export const SpaceClientInfoSchema = SpaceDirectoryConfigSchema.extend({
	/** Account IDs of accounts owning this space */
	owners: AccountIdSchema.array(),
	/** Account IDs of accounts invited to own this space */
	ownerInvites: AccountIdSchema.array(),
	/** List of ongoing space switch groups and their status. */
	spaceSwitchStatus: SpaceSwitchClientStatusSchema.array(),
});
export type SpaceClientInfo = z.infer<typeof SpaceClientInfoSchema>;

export const CurrentSpaceInfoSchema = z.object({
	id: SpaceIdSchema.nullable(),
	config: SpaceClientInfoSchema,
});
export type CurrentSpaceInfo = z.infer<typeof CurrentSpaceInfoSchema>;

/** Space data stored in database */
export const SpaceDataSchema = z.object({
	id: SpaceIdSchema,
	accessId: z.string(),
	/** Account IDs of accounts owning this space */
	owners: AccountIdSchema.array(),
	/** Account IDs of accounts invited to own this space */
	ownerInvites: AccountIdSchema.array().catch(() => []),
	config: SpaceDirectoryConfigSchema,
	spaceState: SpaceStateBundleSchema.catch(() => CloneDeepMutable(SPACE_STATE_BUNDLE_DEFAULT_PUBLIC_SPACE)),
	invites: ZodArrayWithInvalidDrop(SpaceInviteSchema, z.record(z.string(), z.unknown())).catch(() => []),
	/** Data about how active the space is */
	activity: SpaceActivitySavedDataSchema.catch(() => CloneDeepMutable(SPACE_ACTIVITY_DATA_DEFAULT)),
});
/** Space data stored in database */
export type SpaceData = z.infer<typeof SpaceDataSchema>;

export const SPACE_DIRECTORY_UPDATEABLE_PROPERTIES = ['config', 'owners', 'ownerInvites', 'invites', 'activity'] as const satisfies readonly (keyof SpaceData)[];
export const SpaceDataDirectoryUpdateSchema = SpaceDataSchema.pick(ArrayToRecordKeys(SPACE_DIRECTORY_UPDATEABLE_PROPERTIES, true)).partial();
export type SpaceDataDirectoryUpdate = z.infer<typeof SpaceDataDirectoryUpdateSchema>;

export const SPACE_SHARD_UPDATEABLE_PROPERTIES = ['spaceState'] as const satisfies readonly Exclude<keyof SpaceData, ((typeof SPACE_DIRECTORY_PROPERTIES)[number])>[];
export const SpaceDataShardUpdateSchema = SpaceDataSchema.pick(ArrayToRecordKeys(SPACE_SHARD_UPDATEABLE_PROPERTIES, true)).partial();
export type SpaceDataShardUpdate = z.infer<typeof SpaceDataShardUpdateSchema>;

export const SPACE_DIRECTORY_PROPERTIES = [...SPACE_DIRECTORY_UPDATEABLE_PROPERTIES, 'id', 'accessId'] as const satisfies readonly (keyof SpaceData)[];
/** Space data from database, only those relevant to Directory */
export const SpaceDirectoryDataSchema = SpaceDataSchema.pick(ArrayToRecordKeys(SPACE_DIRECTORY_PROPERTIES, true));
/** Space data from database, only those relevant to Directory */
export type SpaceDirectoryData = z.infer<typeof SpaceDirectoryDataSchema>;
