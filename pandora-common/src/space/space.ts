import type { Immutable } from 'immer';
import * as z from 'zod';
import { AccountId } from '../account/account.ts';
import type { AssetFrameworkGlobalState } from '../assets/state/globalState.ts';
import { CharacterId } from '../character/characterTypes.ts';
import type { CharacterModifierEffectData } from '../gameLogic/index.ts';
import { LIMIT_SPACE_NAME_LENGTH, LIMIT_SPACE_NAME_PATTERN } from '../inputLimits.ts';
import { ZodTemplateString, ZodTrimedRegex } from '../validation.ts';
import type { SpaceBaseInfo, SpaceDevelopmentConfig, SpaceDirectoryConfig } from './spaceData.ts';
import type { SpaceRole } from './spaceRoles.ts';

export const ShardFeatureSchema = z.enum(['development']);
export type ShardFeature = z.infer<typeof ShardFeatureSchema>;

export const SpaceIdSchema = ZodTemplateString<`s/${string}`>(z.string(), /^s\//);
export type SpaceId = z.infer<typeof SpaceIdSchema>;

export const SpaceNameSchema = z.string().min(3).max(LIMIT_SPACE_NAME_LENGTH).regex(LIMIT_SPACE_NAME_PATTERN).regex(ZodTrimedRegex);
export type SpaceName = z.infer<typeof SpaceNameSchema>;

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

export const SpaceInviteIdSchema = ZodTemplateString<`i_${string}`>(z.string(), /^i_/);
export type SpaceInviteId = z.infer<typeof SpaceInviteIdSchema>;

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

/** Reason for why a character left (was removed from) a space */
export type SpaceLeaveReason = 'leave' | 'disconnect' | 'destroy' | 'error' | 'kick' | 'ban' | 'automodKick';
