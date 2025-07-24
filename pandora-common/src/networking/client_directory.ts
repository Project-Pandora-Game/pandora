import { Immutable } from 'immer';
import { z } from 'zod';
import { AccountIdSchema, AccountManagementDisableInfoSchema, AccountRoleSchema, AccountSettingsKeysSchema, AccountSettingsSchema, ConfiguredAccountRoleSchema } from '../account/index.ts';
import { AssetFrameworkOutfitWithIdSchema, AssetFrameworkPosePresetWithIdSchema } from '../assets/item/unified.ts';
import { CharacterSelfInfoSchema } from '../character/characterData.ts';
import { CharacterIdSchema } from '../character/characterTypes.ts';
import { ManagementAccountQueryResultSchema } from '../directory/management/account.ts';
import { LIMIT_ACCOUNT_PROFILE_LENGTH, LIMIT_DIRECT_MESSAGE_LENGTH_BASE64 } from '../inputLimits.ts';
import { SpaceDirectoryConfigSchema, SpaceDirectoryUpdateSchema, SpaceIdSchema, SpaceInvite, SpaceInviteCreateSchema, SpaceInviteIdSchema, SpaceListExtendedInfo, SpaceListInfo } from '../space/space.ts';
import { Satisfies } from '../utility/misc.ts';
import { DisplayNameSchema, EmailAddressSchema, HexColorStringSchema, PasswordSha512Schema, SimpleTokenSchema, UserNameSchema, ZodBase64Regex, ZodCast, ZodTruncate } from '../validation.ts';
import { AccountCryptoKeySchema, IDirectoryAccountInfo, IDirectoryDirectMessage, IDirectoryDirectMessageAccount, IDirectoryDirectMessageInfo, IDirectoryShardInfo } from './directory_client.ts';
import type { SocketInterfaceDefinition, SocketInterfaceDefinitionVerified, SocketInterfaceHandlerPromiseResult, SocketInterfaceHandlerResult, SocketInterfaceRequest, SocketInterfaceResponse } from './helpers.ts';

type ShardError = 'noShardFound' | 'failed';

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

export const SecondFactorDataSchema = z.record(SecondFactorTypeSchema, z.string());
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
	shardInfo: {
		request: z.object({}),
		response: ZodCast<{ shards: IDirectoryShardInfo[]; }>(),
	},
	listSpaces: {
		request: z.object({}),
		response: ZodCast<{ spaces: SpaceListInfo[]; }>(),
	},
	spaceGetInfo: {
		request: z.object({
			id: SpaceIdSchema,
			invite: SpaceInviteIdSchema.optional(),
		}),
		response: ZodCast<SpaceExtendedInfoResponse>(),
	},
	spaceCreate: {
		request: SpaceDirectoryConfigSchema,
		response: ZodCast<{ result: 'ok' | 'spaceOwnershipLimitReached' | ShardError; }>(),
	},
	spaceEnter: {
		request: z.object({
			id: SpaceIdSchema,
			invite: SpaceInviteIdSchema.optional(),
		}),
		response: ZodCast<{ result: 'ok' | 'failed' | 'spaceFull' | 'notFound' | 'noAccess' | 'invalidInvite'; }>(),
	},
	spaceLeave: {
		request: z.object({}),
		response: z.object({
			result: z.enum(['ok', 'failed', 'restricted', 'inRoomDevice']),
		}),
	},
	spaceUpdate: {
		request: SpaceDirectoryUpdateSchema,
		response: ZodCast<{ result: 'ok' | 'notInPublicSpace' | 'noAccess'; }>(),
	},
	spaceAdminAction: {
		request: z.object({
			action: z.enum(['kick', 'ban', 'unban', 'allow', 'disallow', 'promote', 'demote']),
			targets: z.array(AccountIdSchema),
		}),
		response: null,
	},
	spaceOwnershipRemove: {
		request: z.object({
			id: SpaceIdSchema,
		}),
		response: ZodCast<{ result: 'ok' | 'notAnOwner'; }>(),
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
