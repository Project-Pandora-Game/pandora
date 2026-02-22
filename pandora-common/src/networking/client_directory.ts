import { Immutable } from 'immer';
import * as z from 'zod';
import { AccountIdSchema, AccountManagementDisableInfoSchema, AccountRoleSchema, AccountSettingsKeysSchema, AccountSettingsSchema, ConfiguredAccountRoleSchema } from '../account/index.ts';
import { AssetFrameworkOutfitWithIdSchema, AssetFrameworkPosePresetWithIdSchema } from '../assets/item/unified.ts';
import { CharacterSelfInfoSchema } from '../character/characterData.ts';
import { CharacterIdSchema } from '../character/characterTypes.ts';
import { ManagementAccountQueryResultSchema } from '../directory/management/account.ts';
import { LIMIT_ACCOUNT_PROFILE_LENGTH, LIMIT_DIRECT_MESSAGE_LENGTH_BASE64, LIMIT_SPACE_SEARCH_COUNT } from '../inputLimits.ts';
import { SpaceIdSchema, SpaceInviteIdSchema, SpaceListExtendedInfo, SpaceListInfo } from '../space/space.ts';
import { SpaceDirectoryConfigSchema, SpaceDirectoryUpdateSchema, SpaceInviteCreateSchema, type SpaceInvite } from '../space/spaceData.ts';
import { SpaceSearchArgumentsSchema, SpaceSearchResultSchema } from '../space/spaceSearch.ts';
import { SpaceSwitchCommandSchema } from '../space/spaceSwitch.ts';
import { Satisfies } from '../utility/misc.ts';
import { DisplayNameSchema, EmailAddressSchema, HexColorStringSchema, PasswordSha512Schema, SimpleTokenSchema, UserNameSchema, ZodBase64Regex, ZodCast, ZodTruncate } from '../validation.ts';
import { AccountCryptoKeySchema, IDirectoryAccountInfo, IDirectoryDirectMessage, IDirectoryDirectMessageAccount, IDirectoryDirectMessageInfo, IDirectoryShardInfo } from './directory_client.ts';
import type { SocketInterfaceDefinition, SocketInterfaceDefinitionVerified, SocketInterfaceHandlerPromiseResult, SocketInterfaceHandlerResult, SocketInterfaceRequest, SocketInterfaceResponse } from './helpers.ts';

export const ShardErrorSchema = z.enum(['noShardFound', 'failed']);
type ShardError = z.infer<typeof ShardErrorSchema>;

export const ClientDirectoryAuthMessageSchema = z.object({
	username: UserNameSchema,
	token: z.string(),
	character: z.object({
		id: CharacterIdSchema,
		secret: z.string(),
	}).nullable(),
});

export type IClientDirectoryAuthMessage = z.infer<typeof ClientDirectoryAuthMessageSchema>;

export const ShardTokenTypeSchema = z.enum(['stable', 'beta', 'testing', 'development']);
export type IShardTokenType = z.infer<typeof ShardTokenTypeSchema>;

export type IBaseTokenInfo = Readonly<{
	id: string;
	expires?: number;
	created: Readonly<{
		id: number;
		username: string;
		time: number;
	}>;
}>;

export type IShardTokenInfo = IBaseTokenInfo & {
	readonly type: IShardTokenType;
};

export type IShardTokenConnectInfo = IShardTokenInfo & {
	connected?: number;
};

export type IBetaKeyInfo = IBaseTokenInfo & {
	readonly maxUses?: number;
	uses: number;
};

export type SpaceExtendedInfoResponse = {
	result: 'notFound' | 'noAccess' | 'noCharacter';
} | {
	result: 'success';
	data: SpaceListExtendedInfo;
	invite?: SpaceInvite;
};

export const AccountPublicInfoSchema = z.object({
	id: AccountIdSchema,
	displayName: z.string(),
	labelColor: HexColorStringSchema,
	created: z.number(),
	visibleRoles: z.array(AccountRoleSchema),
	profileDescription: z.string().transform(ZodTruncate(LIMIT_ACCOUNT_PROFILE_LENGTH)),
});
export type AccountPublicInfo = z.infer<typeof AccountPublicInfoSchema>;

export const SecondFactorTypeSchema = z.enum(['captcha']);
export type SecondFactorType = z.infer<typeof SecondFactorTypeSchema>;

export const SecondFactorDataSchema = z.partialRecord(SecondFactorTypeSchema, z.string().optional());
export type SecondFactorData = z.infer<typeof SecondFactorDataSchema>;

export type SecondFactorResponse = {
	result: 'secondFactorRequired';
	types: SecondFactorType[];
} | {
	result: 'secondFactorInvalid';
	types: SecondFactorType[];
	missing: SecondFactorType[];
	invalid: SecondFactorType[];
};

/** Client->Directory messages */
export const ClientDirectorySchema = {
	//#region Before Login
	login: {
		request: z.object({
			username: UserNameSchema,
			passwordSha512: PasswordSha512Schema,
			verificationToken: SimpleTokenSchema.optional(),
			secondFactor: SecondFactorDataSchema.optional(),
		}),
		response: ZodCast<{ result: 'verificationRequired' | 'invalidToken' | 'unknownCredentials'; } | SecondFactorResponse | {
			result: 'accountDisabled';
			reason: string;
		} | {
			result: 'ok';
			token: { value: string; expires: number; };
			account: IDirectoryAccountInfo;
		}>(),
	},
	register: {
		request: z.object({
			username: UserNameSchema,
			displayName: DisplayNameSchema,
			passwordSha512: PasswordSha512Schema,
			email: EmailAddressSchema,
			betaKey: z.string().optional(),
			captchaToken: z.string().optional(),
		}),
		response: ZodCast<{ result: 'ok' | 'usernameTaken' | 'emailTaken' | 'invalidBetaKey' | 'invalidCaptcha' | 'failed'; }>(),
	},
	resendVerificationEmail: {
		request: z.object({
			email: EmailAddressSchema,
			captchaToken: z.string().optional(),
		}),
		response: ZodCast<{ result: 'maybeSent' | 'invalidCaptcha' | 'failed'; }>(),
	},
	resendVerificationEmailAdvanced: {
		request: z.object({
			username: UserNameSchema,
			passwordSha512: PasswordSha512Schema,
			email: EmailAddressSchema,
			captchaToken: z.string().optional(),
			overrideEmail: z.boolean(),
		}),
		response: ZodCast<{ result: 'ok' | 'unknownCredentials' | 'emailTaken' | 'alreadyActivated' | 'invalidCaptcha' | 'invalidEmail' | 'failed'; } | {
			result: 'rateLimited';
			time: number;
		}>(),
	},
	passwordReset: {
		request: z.object({
			email: EmailAddressSchema,
			captchaToken: z.string().optional(),
		}),
		response: ZodCast<{ result: 'maybeSent' | 'invalidCaptcha' | 'failed'; }>(),
	},
	passwordResetConfirm: {
		request: z.object({
			username: UserNameSchema,
			passwordSha512: PasswordSha512Schema,
			token: SimpleTokenSchema,
		}),
		response: ZodCast<{ result: 'ok' | 'unknownCredentials' | 'failed'; }>(),
	},
	//#endregion Before Login

	//#region Account management
	passwordChange: {
		request: z.object({
			passwordSha512Old: PasswordSha512Schema,
			passwordSha512New: PasswordSha512Schema,
			cryptoKey: AccountCryptoKeySchema,
		}),
		response: ZodCast<{ result: 'ok' | 'invalidPassword'; }>(),
	},
	logout: {
		request: z.discriminatedUnion('type', [
			z.object({
				type: z.enum(['self', 'all']),
			}),
			z.object({
				type: z.literal('selected'),
				accountTokenId: z.string(),
			}),
		]),
		response: null,
	},
	gitHubBind: {
		request: z.object({
			login: z.string(),
		}),
		response: ZodCast<{ url: string; }>(),
	},
	gitHubUnbind: {
		request: z.object({}),
		response: null,
	},
	changeSettings: {
		request: z.discriminatedUnion('type', [
			z.object({
				type: z.literal('set'),
				settings: AccountSettingsSchema.partial(),
			}),
			z.object({
				type: z.literal('reset'),
				settings: AccountSettingsKeysSchema.array().max(AccountSettingsKeysSchema.options.length),
			}),
		]),
		response: z.object({
			result: z.literal('ok'),
		}),
	},
	setCryptoKey: {
		request: z.object({
			cryptoKey: AccountCryptoKeySchema,
			/**
			 * Whether to allow setting a new crypto key if one is set already.
			 * Has three possible values:
			 * - `undefined` - Doesn't allow reseting key if it has already been set
			 * - `'same-key'` - Only allows replacing the key if the new one has same public key (re-encrypted private key)
			 * - `'replace-deleting-dms'` - Allows replacing the key completely. This will cause existing DMs to be lost.
			 * @default undefined
			 */
			allowReset: z.enum(['same-key', 'replace-deleting-dms']).optional(),
		}),
		response: ZodCast<{ result: 'ok' | 'invalid' | 'keyAlreadySet'; }>(),
	},
	queryConnections: {
		request: z.object({}),
		response: z.object({
			connections: z.array(z.object({
				loginTokenId: z.string(),
				connectionCount: z.number(),
				connectedCharacters: z.array(z.object({
					id: CharacterIdSchema,
					name: z.string(),
				})),
			})),
		}),
	},
	extendLoginToken: {
		request: z.object({
			passwordSha512: PasswordSha512Schema,
		}),
		response: z.object({
			result: z.enum(['ok', 'invalidPassword']),
		}),
	},
	//#endregion

	getAccountInfo: {
		request: z.object({
			accountId: AccountIdSchema,
		}),
		response: z.discriminatedUnion('result', [
			z.object({
				result: z.literal('ok'),
				info: AccountPublicInfoSchema,
			}),
			z.object({
				result: z.literal('notFoundOrNoAccess'),
			}),
		]),
	},
	updateProfileDescription: {
		request: z.object({
			profileDescription: z.string().max(LIMIT_ACCOUNT_PROFILE_LENGTH),
		}),
		response: z.object({
			result: z.literal('ok'),
		}),
	},

	//#region Character management
	listCharacters: {
		request: z.object({}),
		response: z.discriminatedUnion('result', [
			z.object({
				result: z.literal('ok'),
				characters: CharacterSelfInfoSchema.array(),
				limit: z.number().int().nonnegative(),
			}),
			z.object({
				result: z.literal('notLoggedIn'),
			}),
		]),
	},
	createCharacter: {
		request: z.object({}),
		response: ZodCast<{ result: 'ok' | 'maxCharactersReached' | ShardError; }>(),
	},
	deleteCharacter: {
		request: z.object({
			id: CharacterIdSchema,
			passwordSha512: PasswordSha512Schema,
		}),
		response: ZodCast<{ result: 'ok' | 'invalidPassword' | 'failed'; }>(),
	},
	//#endregion

	//#region Character connection, shard interaction
	connectCharacter: {
		request: z.object({
			id: CharacterIdSchema,
		}),
		response: ZodCast<{ result: 'ok' | ShardError; }>(),
	},
	disconnectCharacter: {
		request: z.object({}),
		response: null,
	},
	// Simple, single-person, instant space switch
	spaceSwitch: {
		request: z.object({
			/** Id of the space to switch to, or `null` if switching to personal space */
			id: SpaceIdSchema.nullable(),
			/** Invite link we are using to join */
			invite: SpaceInviteIdSchema.optional(),
		}),
		response: z.object({
			result: z.literal(['ok', 'failed', 'spaceFull', 'notFound', 'noAccess', 'invalidInvite', 'restricted', 'inRoomDevice']),
		}),
	},
	// Group space switch - this message starts it
	spaceSwitchStart: {
		request: z.object({
			/** Id of the space to switch to, can not be a personal space */
			id: SpaceIdSchema,
			/** Characters being invited along; can be empty */
			characters: CharacterIdSchema.array(),
		}),
		response: z.discriminatedUnion('result', [
			z.object({
				result: z.literal([
					'ok',
					'failed', // Generic, usually transient failure - try again later
					'pendingSwitchExists', // There already is a switch by you - abort it first
					'notFound', // Target space or some character to invite was not found
				]),
			}),
			z.object({
				result: z.literal([
					'noAccess', // No access to the target space
					'notAllowed', // Not allowed to invite some of the characters
				]),
				problematicCharacter: CharacterIdSchema,
			}),
		]),
	},
	// Group space switch - this message interacts with ongoing switch
	spaceSwitchCommand: {
		request: z.object({
			/** Initiator of switch, used to identify this switch group */
			initiator: CharacterIdSchema,
			/** Command to perform on the ongoing switch */
			command: SpaceSwitchCommandSchema,
		}),
		response: z.object({
			result: z.literal([
				'ok',
				'failed', // Generic, usually transient failure - try again later
				'notFound', // The space or space switch group was not found (e.g. if it disappeared before client got update)
				'notAllowed', // You cannot do this action (e.g. you are not the initiator, or you are trying to set something that initiator can't)
				'restricted', // You cannot do this action (e.g. restricted by modifier)
			]),
		}),
	},
	// Group space switch - do the switch
	spaceSwitchGo: {
		request: z.object({}),
		response: z.object({
			result: z.literal([
				'ok',
				'notFound', // The space or space switch group was not found (e.g. if it disappeared before client got update)
				'failed', // Generic, usually transient failure - try again later
				'spaceFull', // Target space is full
				'notReady', // Some character is not ready
				'noAccess', // Some character does not have access to target space
			]),
		}),
	},
	//#endregion

	shardInfo: {
		request: z.object({}),
		response: ZodCast<{ shards: IDirectoryShardInfo[]; }>(),
	},

	//#region Space search
	listSpaces: { // Get list of currently active spaces
		request: z.object({}),
		response: ZodCast<{ spaces: SpaceListInfo[]; }>(),
	},
	spaceSearch: { // Search through all public spaces
		request: z.object({
			args: SpaceSearchArgumentsSchema,
			limit: z.int().positive().max(LIMIT_SPACE_SEARCH_COUNT),
			skip: z.number().int().nonnegative().optional(),
		}),
		response: z.object({
			result: SpaceSearchResultSchema,
		}),
	},
	spaceGetInfo: {
		request: z.object({
			id: SpaceIdSchema,
			/** Use invitation link to get access to info if we otherwise wouldn't be able to */
			invite: SpaceInviteIdSchema.optional(),
			/** Use ongoing space invitation to get access to info if we otherwise wouldn't be able to */
			invitedBy: CharacterIdSchema.optional(),
		}),
		response: ZodCast<SpaceExtendedInfoResponse>(),
	},
	//#endregion

	//#region Space management
	spaceCreate: {
		request: SpaceDirectoryConfigSchema,
		response: z.object({
			result: z.enum([
				'ok',
				'spaceOwnershipLimitReached',
				'accountListNotAllowed', // Some accounts cannot be included in some lists upon space creation
				// The creation succeeded, but joining the just-created space failed
				'restricted',
				'inRoomDevice',
			])
				.or(ShardErrorSchema),
		}),
	},
	spaceUpdate: {
		request: SpaceDirectoryUpdateSchema,
		response: z.object({
			result: z.enum([
				'ok',
				'failed', // Generic failure
				'notInPublicSpace', // Must be in a public space (not personal space) to do this
				'noAccess', // Must be an admin
				'targetNotAllowed', // Changes affecting specific accounts can be limited
			]),
		}),
	},
	spaceAdminAction: {
		request: z.object({
			action: z.enum(['kick', 'ban', 'unban', 'allow', 'disallow', 'promote', 'demote']),
			targets: z.array(AccountIdSchema),
		}),
		response: z.object({
			result: z.enum([
				'ok',
				'failed', // Generic failure
				'notInPublicSpace', // Must be in a public space (not personal space) to do this
				'noAccess', // Must be an admin
				'targetNotAllowed', // Changes affecting specific accounts can be limited
			]),
		}),
	},
	spaceDropRole: { // Stop being an admin or allow-listed account of any space
		request: z.object({
			space: SpaceIdSchema,
			role: z.enum(['admin', 'allowlisted']),
		}),
		response: z.object({
			result: z.enum([
				'ok', // Removed or we don't have the role in the first place
				'failed', // Generic failure
				'notFound', // Space not found
			]),
		}),
	},
	spaceOwnership: {
		request: z.discriminatedUnion('action', [
			z.object({
				/** Drop own ownership of a space */
				action: z.literal('abandon'),
				space: SpaceIdSchema,
			}),
			z.object({
				/** Invite an admin to become an owner of the space, or cancel the invitation */
				action: z.enum(['invite', 'inviteCancel']),
				space: SpaceIdSchema,
				target: AccountIdSchema,
			}),
			z.object({
				/** Accept or refuse an ownership invitation */
				action: z.enum(['inviteAccept', 'inviteRefuse']),
				space: SpaceIdSchema,
			}),
		]),
		response: ZodCast<{
			result:
			| 'ok'
			| 'failed' // Generic failure
			| 'notFound' // Space not found
			| 'notAnOwner' // abandon, invite, inviteCancel: You need to be an owner of the space to do this
			| 'targetNotAdmin' // invite: Target needs to already be an admin to promote to owner
			| 'targetNotAllowed' // invite: Target needs to be present or on contacts list to promote to owner
			| 'inviteNotFound' // inviteCancel, inviteAccept, inviteRefuse: There is no pending invite for target/player
			| 'spaceOwnershipLimitReached' // inviteAccept: Too many spaces owned
			;
		}>(),
	},
	spaceInvite: {
		request: z.discriminatedUnion('action', [
			z.object({
				action: z.literal('create'),
				data: SpaceInviteCreateSchema,
			}),
			z.object({
				action: z.literal('delete'),
				id: SpaceInviteIdSchema,
			}),
			z.object({
				action: z.literal('list'),
			}),
		]),
		response: ZodCast<{ result: 'ok' | 'requireAdmin' | 'tooManyInvites' | 'invalidData' | 'notFound'; } | {
			result: 'list';
			invites: SpaceInvite[];
			/** If this is set, there are some valid invites that were not returned due to missing permissions.
			 * @default false
			 */
			someHidden?: boolean;
		} | {
			result: 'created';
			invite: SpaceInvite;
		}>(),
	},
	//#endregion

	//#region Outfits
	storedOutfitsGetAll: {
		request: z.object({}),
		response: z.object({
			storedOutfits: AssetFrameworkOutfitWithIdSchema.array(),
		}),
	},
	storedOutfitsSave: {
		request: z.object({
			storedOutfits: AssetFrameworkOutfitWithIdSchema.array(),
		}),
		response: z.discriminatedUnion('result', [
			z.object({
				result: z.literal('ok'),
			}),
			z.object({
				result: z.literal('failed'),
				reason: z.enum(['storageFull']),
			}),
		]),
	},
	//#endregion

	//#region Pose
	storedPosePresetsGetAll: {
		request: z.object({}),
		response: z.object({
			storedPosePresets: AssetFrameworkPosePresetWithIdSchema.array(),
		}),
	},
	storedPosePresetsSave: {
		request: z.object({
			storedPosePresets: AssetFrameworkPosePresetWithIdSchema.array(),
		}),
		response: z.discriminatedUnion('result', [
			z.object({
				result: z.literal('ok'),
			}),
			z.object({
				result: z.literal('failed'),
				reason: z.enum(['storageFull']),
			}),
		]),
	},
	//#endregion

	getDirectMessages: {
		request: z.object({
			id: AccountIdSchema,
		}),
		response: ZodCast<{ result: 'notFound' | 'denied' | 'noKeyAvailable'; } | {
			result: 'ok';
			account: IDirectoryDirectMessageAccount;
			messages: IDirectoryDirectMessage[];
		}>(),
	},
	sendDirectMessage: {
		request: z.object({
			id: AccountIdSchema,
			keyHash: z.string().regex(ZodBase64Regex),
			/**
			 * Content of the message.
			 * Can be either a `base64(salt):base64(encrypt(message))` or empty (when deleting a message).
			 */
			content: z.string().regex(/^([A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+)?$/).max(LIMIT_DIRECT_MESSAGE_LENGTH_BASE64),
			editing: z.number().min(0).optional(),
		}),
		response: ZodCast<{ result: 'ok' | 'notFound' | 'denied' | 'badKey' | 'messageNotFound'; }>(),
	},
	directMessage: {
		request: z.object({
			id: AccountIdSchema,
			action: z.enum(['read', 'close']),
		}),
		response: null,
	},
	getDirectMessageInfo: {
		request: z.object({}),
		response: ZodCast<{ info: IDirectoryDirectMessageInfo[]; }>(),
	},
	friendRequest: {
		request: z.object({
			id: AccountIdSchema,
			action: z.enum(['initiate', 'accept', 'decline', 'cancel']),
		}),
		response: ZodCast<{
			result: 'ok' | 'accountNotFound' | 'requestNotFound' | 'blocked' | 'requestAlreadyExists';
		}>(),
	},
	unfriend: {
		request: z.object({
			id: AccountIdSchema,
		}),
		response: ZodCast<{
			result: 'ok' | 'accountNotFound';
		}>(),
	},
	blockList: {
		request: z.object({
			id: AccountIdSchema,
			action: z.enum(['add', 'remove']),
		}),
		response: null,
	},

	//#region Management/admin endpoints; these require specific roles to be used

	// Account role assignment
	manageAccountGet: {
		request: z.object({
			id: AccountIdSchema,
		}),
		response: ManagementAccountQueryResultSchema,
	},
	manageAccountDisable: {
		request: z.object({
			id: AccountIdSchema,
			disable: AccountManagementDisableInfoSchema.omit({ time: true, disabledBy: true }).nullable(),
		}),
		response: ZodCast<{ result: 'ok' | 'notFound' | 'notAllowed'; }>(),
	},
	manageSetAccountRole: {
		request: z.object({
			id: z.number(),
			role: ConfiguredAccountRoleSchema,
			expires: z.number().optional(),
		}),
		response: ZodCast<{ result: 'ok' | 'notFound'; }>(),
	},

	// Shard token management
	manageCreateShardToken: {
		request: z.object({
			/**
			 * Type of the token to create.
			 * stable/beta requires admin role.
			 *
			 * each type has required role to access it:
			 * stable: none
			 * beta: developer, contributor, supporter
			 * testing: developer, contributor
			 * development: developer
			 */
			type: ShardTokenTypeSchema,
			/**
			 * If set, the token will expire at this time.
			 * If not set, the token will never expire.
			 * Directory may change this value.
			 */
			expires: z.number().optional(),
		}),
		response: ZodCast<{ result: 'adminRequired'; } | {
			result: 'ok';
			info: IShardTokenInfo;
			token: string;
		}>(),
	},
	manageInvalidateShardToken: {
		request: z.object({
			id: z.string(),
		}),
		response: ZodCast<{ result: 'ok' | 'notFound' | 'adminRequired'; }>(),
	},
	manageListShardTokens: {
		request: z.object({}),
		response: ZodCast<{ info: IShardTokenConnectInfo[]; }>(),
	},
	manageCreateBetaKey: {
		request: z.object({
			expires: z.number().optional(),
			maxUses: z.number().optional(),
		}),
		response: ZodCast<{ result: 'adminRequired'; } | {
			result: 'ok';
			info: IBetaKeyInfo;
			token: string;
		}>(),
	},
	manageListBetaKeys: {
		request: z.object({}),
		response: ZodCast<{ keys: IBetaKeyInfo[]; }>(),
	},
	manageInvalidateBetaKey: {
		request: z.object({
			id: z.string(),
		}),
		response: ZodCast<{ result: 'ok' | 'notFound' | 'adminRequired'; }>(),
	},
	//#endregion
} as const satisfies Immutable<SocketInterfaceDefinition>;

export type IClientDirectory = Satisfies<typeof ClientDirectorySchema, SocketInterfaceDefinitionVerified<typeof ClientDirectorySchema>>;
export type IClientDirectoryArgument = SocketInterfaceRequest<IClientDirectory>;
export type IClientDirectoryResult = SocketInterfaceHandlerResult<IClientDirectory>;
export type IClientDirectoryPromiseResult = SocketInterfaceHandlerPromiseResult<IClientDirectory>;
export type IClientDirectoryNormalResult = SocketInterfaceResponse<IClientDirectory>;
