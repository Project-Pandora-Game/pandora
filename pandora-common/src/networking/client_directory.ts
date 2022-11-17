import type { SocketInterfaceDefinitionVerified, SocketInterfaceHandlerPromiseResult, SocketInterfaceHandlerResult, SocketInterfaceRequest, SocketInterfaceResponse } from './helpers';
import { AccountCryptoKeySchema, DirectoryAccountSettingsSchema, IDirectoryAccountInfo, IDirectoryCharacterConnectionInfo, IDirectoryDirectMessage, IDirectoryDirectMessageAccount, IDirectoryDirectMessageInfo, IDirectoryShardInfo } from './directory_client';
import { CharacterIdSchema, ICharacterSelfInfo } from '../character';
import { ChatRoomDirectoryConfigSchema, ChatRoomDirectoryUpdateSchema, IChatRoomDirectoryInfo, RoomIdSchema } from '../chatroom';
import { ConfiguredAccountRoleSchema, IAccountRoleManageInfo } from '../account';
import { EmailAddressSchema, PasswordSha512Schema, SimpleTokenSchema, UserNameSchema, ZodCast } from '../validation';
import { z } from 'zod';
import { Satisfies } from '../utility';

type ShardError = 'noShardFound' | 'failed';

type ShardConnection<T = ShardError> = {
	result: T;
} | ({
	result: 'ok';
} & IDirectoryCharacterConnectionInfo);

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

export type IBaseTokenInfo = {
	id: string;
	expires?: number;
	created: { id: number; username: string; time: number; };
};

export type IShardTokenInfo = IBaseTokenInfo & {
	type: IShardTokenType;
};

/** Client->Directory messages */
export const ClientDirectorySchema = {
	//#region Before Login
	login: {
		request: z.object({
			username: UserNameSchema,
			passwordSha512: PasswordSha512Schema,
			verificationToken: SimpleTokenSchema.optional(),
		}),
		response: ZodCast<{ result: 'verificationRequired' | 'invalidToken' | 'unknownCredentials'; } | {
			result: 'ok';
			token: { value: string; expires: number; };
			account: IDirectoryAccountInfo;
		}>(),
	},
	register: {
		request: z.object({
			username: UserNameSchema,
			passwordSha512: PasswordSha512Schema,
			email: EmailAddressSchema,
			betaKey: z.string().optional(),
		}),
		response: ZodCast<{ result: 'ok' | 'usernameTaken' | 'emailTaken' | 'invalidBetaKey'; }>(),
	},
	resendVerificationEmail: {
		request: z.object({
			email: EmailAddressSchema,
		}),
		response: ZodCast<{ result: 'maybeSent'; }>(),
	},
	passwordReset: {
		request: z.object({
			email: EmailAddressSchema,
		}),
		response: ZodCast<{ result: 'maybeSent'; }>(),
	},
	passwordResetConfirm: {
		request: z.object({
			username: UserNameSchema,
			passwordSha512: PasswordSha512Schema,
			token: SimpleTokenSchema,
		}),
		response: ZodCast<{ result: 'ok' | 'unknownCredentials'; }>(),
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
		request: z.object({
			invalidateToken: z.string().optional(),
		}),
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
		request: DirectoryAccountSettingsSchema.partial(),
		response: null,
	},
	setCryptoKey: {
		request: z.object({
			cryptoKey: AccountCryptoKeySchema,
		}),
		response: null,
	},
	//#endregion

	//#region Character management
	listCharacters: {
		request: z.object({}),
		response: ZodCast<{
			characters: ICharacterSelfInfo[];
			limit: number;
		}>(),
	},
	createCharacter: {
		request: z.object({}),
		response: ZodCast<ShardConnection<ShardError | 'maxCharactersReached'>>(),
	},
	updateCharacter: {
		request: z.object({
			id: CharacterIdSchema,
			preview: z.string().optional(),
		}),
		response: ZodCast<ICharacterSelfInfo>(),
	},
	deleteCharacter: {
		request: z.object({
			id: CharacterIdSchema,
		}),
		response: ZodCast<{ result: 'ok' | 'characterInUse'; }>(),
	},
	//#endregion

	//#region Character connection, shard interaction
	connectCharacter: {
		request: z.object({
			id: CharacterIdSchema,
		}),
		response: ZodCast<ShardConnection>(),
	},
	disconnectCharacter: {
		request: z.object({}),
		response: null,
	},
	shardInfo: {
		request: z.object({}),
		response: ZodCast<{ shards: IDirectoryShardInfo[]; }>(),
	},
	listRooms: {
		request: z.object({}),
		response: ZodCast<{ rooms: IChatRoomDirectoryInfo[]; }>(),
	},
	chatRoomCreate: {
		request: ChatRoomDirectoryConfigSchema,
		response: ZodCast<ShardConnection<ShardError | 'nameTaken'>>(),
	},
	chatRoomEnter: {
		request: z.object({
			id: RoomIdSchema,
			password: z.string().optional(),
		}),
		response: ZodCast<ShardConnection<'failed' | 'errFull' | 'notFound' | 'noAccess' | 'invalidPassword'>>(),
	},
	chatRoomLeave: {
		request: z.object({}),
		response: null,
	},
	chatRoomUpdate: {
		request: ChatRoomDirectoryUpdateSchema,
		response: ZodCast<{ result: 'ok' | 'nameTaken' | 'notInRoom' | 'noAccess'; }>(),
	},
	//#endregion

	getDirectMessages: {
		request: z.object({
			id: z.number().min(0),
			until: z.number().min(0).optional(),
		}),
		response: ZodCast<{ result: 'notFound' | 'denied'; } | {
			result: 'ok';
			account: IDirectoryDirectMessageAccount;
			messages: IDirectoryDirectMessage[];
		}>(),
	},
	sendDirectMessage: {
		request: z.object({
			id: z.number().min(0),
			content: z.string(),
			editing: z.number().min(0).optional(),
		}),
		response: ZodCast<{ result: 'ok' | 'notFound' | 'denied' | 'messageNotFound'; }>(),
	},
	directMessage: {
		request: z.object({
			id: z.number().min(0),
			action: z.enum(['read', 'close']),
		}),
		response: null,
	},
	getDirectMessageInfo: {
		request: z.object({}),
		response: ZodCast<{ info: IDirectoryDirectMessageInfo[]; }>(),
	},

	//#region Management/admin endpoints; these require specific roles to be used

	// Account role assignment
	manageGetAccountRoles: {
		request: z.object({
			id: z.number(),
		}),
		response: ZodCast<{ result: 'notFound'; } | {
			result: 'ok';
			roles: IAccountRoleManageInfo;
		}>(),
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
		response: ZodCast<{ result: 'ok' | 'notFound'; }>(),
	},
	manageListShardTokens: {
		request: z.object({}),
		response: ZodCast<{ info: IShardTokenInfo[]; }>(),
	},
	//#endregion
} as const;

export type IClientDirectory = Satisfies<typeof ClientDirectorySchema, SocketInterfaceDefinitionVerified<typeof ClientDirectorySchema>>;
export type IClientDirectoryArgument = SocketInterfaceRequest<IClientDirectory>;
export type IClientDirectoryResult = SocketInterfaceHandlerResult<IClientDirectory>;
export type IClientDirectoryPromiseResult = SocketInterfaceHandlerPromiseResult<IClientDirectory>;
export type IClientDirectoryNormalResult = SocketInterfaceResponse<IClientDirectory>;
