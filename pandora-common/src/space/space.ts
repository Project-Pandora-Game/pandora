import type { Immutable } from 'immer';
import * as z from 'zod';
import { AccountId, AccountIdSchema } from '../account/account.ts';
import type { AssetFrameworkGlobalState } from '../assets/state/globalState.ts';
import { SPACE_STATE_BUNDLE_DEFAULT_PUBLIC_SPACE, SpaceStateBundleSchema } from '../assets/state/spaceState.ts';
import { CharacterId, CharacterIdSchema } from '../character/characterTypes.ts';
import type { CharacterModifierEffectData } from '../gameLogic/index.ts';
import { LIMIT_SPACE_DESCRIPTION_LENGTH, LIMIT_SPACE_ENTRYTEXT_LENGTH, LIMIT_SPACE_MAX_CHARACTER_NUMBER, LIMIT_SPACE_NAME_LENGTH, LIMIT_SPACE_NAME_PATTERN } from '../inputLimits.ts';
import { ArrayToRecordKeys, CloneDeepMutable } from '../utility/misc.ts';
import { ZodArrayWithInvalidDrop, ZodTemplateString, ZodTrimedRegex } from '../validation.ts';
import type { SpaceRole } from './spaceRoles.ts';

export const ShardFeatureSchema = z.enum(['development']);
export type ShardFeature = z.infer<typeof ShardFeatureSchema>;

export const SpaceIdSchema = ZodTemplateString<`s/${string}`>(z.string(), /^s\//);
export type SpaceId = z.infer<typeof SpaceIdSchema>;

export const SpaceFeatureSchema = z.enum([
	// Allows characters inside to change their body
	'allowBodyChanges',
	// Enables development options for the space
	'development',
]);
export type SpaceFeature = z.infer<typeof SpaceFeatureSchema>;

export type ActionSpaceContext = {
	features: readonly SpaceFeature[];
	development: Readonly<SpaceDevelopmentConfig> | undefined;
	getAccountSpaceRole(account: AccountId): SpaceRole;
	getCharacterModifierEffects(character: CharacterId, gameState: AssetFrameworkGlobalState): readonly Immutable<CharacterModifierEffectData>[];
};

/**
 * Spaces are private by default and can be published to be seen in public space search.
 * There are three levels of publishing of a space:
 * - `locked` - same visibility as `private`, but only admins and owners can join (they also get confirmation dialog)
 * - `private` - the space is only visible to Allow-listed accounts, admins and owners
 * - `public-with-admin` - the space is visible to anyone while there is an online admin inside
 * - `public-with-anyone` - the space is visible to anyone while there is anyone online inside
 */
export const SpacePublicSettingSchema = z.preprocess(
	(arg, _ctx) => {
		// Migrate from old values
		if (arg === false)
			return 'private';
		if (arg === true)
			return 'public-with-admin';
		return arg;
	},
	// The actual schema
	z.enum(['locked', 'private', 'public-with-admin', 'public-with-anyone']),
);
export type SpacePublicSetting = z.infer<typeof SpacePublicSettingSchema>;

export const SpaceBaseInfoSchema = z.object({
	/** The name of the space */
	name: z.string().min(3).max(LIMIT_SPACE_NAME_LENGTH).regex(LIMIT_SPACE_NAME_PATTERN).regex(ZodTrimedRegex),
	/** The description of the space */
	description: z.string().max(LIMIT_SPACE_DESCRIPTION_LENGTH),
	/** The entry text of the space, shown to players when they enter */
	entryText: z.string().max(LIMIT_SPACE_ENTRYTEXT_LENGTH).catch(''),
	/**
	 * Whether the space is private or public (under some conditions)
	 * @see SpacePublicSettingSchema
	 */
	public: SpacePublicSettingSchema,
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

export const SpaceGhostManagementConfigSchema = z.object({
	/**
	 * Which characters to exclude from automatic ghost management.
	 * - `none` = applies to all characters
	 * - `owner` = Owners are excluded
	 * - `admin` = Owners and admins are excluded
	 * - `allowed` = Owners, admins, and people on allowlist are excluded
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
	/** Whether there is a friend contact inside this space. Not filled if this account cannot see extended info of this space. */
	hasFriend?: boolean;
	/** List of the space's owners */
	owners: AccountId[];
};

/** Info sent to client when displaying details about a space */
export type SpaceListExtendedInfo = SpaceListInfo & Pick<SpaceDirectoryConfig, 'features' | 'admin'> & {
	// Note: `isAdmin` is not part of the basic info (`SpaceListInfo`), as it has more complex check than `isOwner` and shouldn't be done en masse
	/** Whether the account that requested the info is admin of this space */
	isAdmin: boolean;
	isAllowed: boolean;
	characters: {
		id: CharacterId;
		accountId: number;
		name: string;
		isOnline: boolean;
		isAdmin: boolean;
	}[];
};

export const SpaceClientInfoSchema = SpaceDirectoryConfigSchema.extend({
	/** Account IDs of accounts owning this space */
	owners: AccountIdSchema.array(),
	/** Account IDs of accounts invited to own this space */
	ownerInvites: AccountIdSchema.array(),
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
});
/** Space data stored in database */
export type SpaceData = z.infer<typeof SpaceDataSchema>;

export const SPACE_DIRECTORY_UPDATEABLE_PROPERTIES = ['config', 'owners', 'ownerInvites', 'invites'] as const satisfies readonly (keyof SpaceData)[];
export const SpaceDataDirectoryUpdateSchema = SpaceDataSchema.pick(ArrayToRecordKeys(SPACE_DIRECTORY_UPDATEABLE_PROPERTIES, true)).partial();
export type SpaceDataDirectoryUpdate = z.infer<typeof SpaceDataDirectoryUpdateSchema>;

export const SPACE_SHARD_UPDATEABLE_PROPERTIES = ['spaceState'] as const satisfies readonly Exclude<keyof SpaceData, ((typeof SPACE_DIRECTORY_PROPERTIES)[number])>[];
export const SpaceDataShardUpdateSchema = SpaceDataSchema.pick(ArrayToRecordKeys(SPACE_SHARD_UPDATEABLE_PROPERTIES, true)).partial();
export type SpaceDataShardUpdate = z.infer<typeof SpaceDataShardUpdateSchema>;

export const SPACE_DIRECTORY_PROPERTIES = ['id', 'config', 'owners', 'ownerInvites', 'accessId', 'invites'] as const satisfies readonly (keyof SpaceData)[];
/** Space data from database, only those relevant to Directory */
export const SpaceDirectoryDataSchema = SpaceDataSchema.pick(ArrayToRecordKeys(SPACE_DIRECTORY_PROPERTIES, true));
/** Space data from database, only those relevant to Directory */
export type SpaceDirectoryData = z.infer<typeof SpaceDirectoryDataSchema>;

/** Reason for why a character left (was removed from) a space */
export type SpaceLeaveReason = 'leave' | 'disconnect' | 'destroy' | 'error' | 'kick' | 'ban' | 'automodKick';
