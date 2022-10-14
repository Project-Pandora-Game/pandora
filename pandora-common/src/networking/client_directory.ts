import type { SocketInterface, RecordOnly, SocketInterfaceArgs, SocketInterfaceUnconfirmedArgs, SocketInterfaceResult, SocketInterfaceResponseHandler, SocketInterfaceOneshotHandler, SocketInterfaceNormalResult, SocketInterfacePromiseResult, DefineSocketInterface } from './helpers';
import { DirectoryAccountSettingsSchema, IDirectoryAccountInfo, IDirectoryCharacterConnectionInfo, IDirectoryDirectMessage, IDirectoryDirectMessageAccount, IDirectoryShardInfo } from './directory_client';
import type { MessageHandler } from './message_handler';
import { CharacterIdSchema, ICharacterSelfInfo } from '../character';
import { ChatRoomDirectoryConfigSchema, ChatRoomDirectoryUpdateSchema, IChatRoomDirectoryInfo, RoomIdSchema } from '../chatroom';
import { ConfiguredAccountRoleSchema, IAccountRoleManageInfo } from '../account';
import { EmailAddressSchema, PasswordSha512Schema, SimpleTokenSchema, UserNameSchema } from '../validation';
import { z } from 'zod';

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

export type IShardTokenInfo = {
	id: string;
	type: IShardTokenType;
	expires?: number;
	created: { id: number; username: string; time: number; };
};

export const ClientDirectoryInSchema = z.object({
	//#region Before Login
	login: z.object({
		username: UserNameSchema,
		passwordSha512: PasswordSha512Schema,
		verificationToken: SimpleTokenSchema.optional(),
	}),
	register: z.object({
		username: UserNameSchema,
		passwordSha512: PasswordSha512Schema,
		email: EmailAddressSchema,
		betaKey: z.string().optional(),
	}),
	resendVerificationEmail: z.object({
		email: EmailAddressSchema,
	}),
	passwordReset: z.object({
		email: EmailAddressSchema,
	}),
	passwordResetConfirm: z.object({
		username: UserNameSchema,
		passwordSha512: PasswordSha512Schema,
		token: SimpleTokenSchema,
	}),
	//#endregion Before Login

	//#region Account management
	passwordChange: z.object({
		passwordSha512Old: PasswordSha512Schema,
		passwordSha512New: PasswordSha512Schema,
		cryptoKey: z.string(),
	}),
	logout: z.object({
		invalidateToken: z.string().optional(),
	}),
	gitHubBind: z.object({
		login: z.string(),
	}),
	gitHubUnbind: z.object({}),
	changeSettings: DirectoryAccountSettingsSchema.partial(),
	setCryptoKey: z.object({
		cryptoKey: z.string(),
	}),
	//#endregion

	//#region Character management
	listCharacters: z.object({}),
	createCharacter: z.object({}),
	updateCharacter: z.object({
		id: CharacterIdSchema,
		preview: z.string().optional(),
	}),
	deleteCharacter: z.object({
		id: CharacterIdSchema,
	}),
	//#endregion

	//#region Character connection, shard interaction
	connectCharacter: z.object({
		id: CharacterIdSchema,
	}),
	disconnectCharacter: z.object({}),
	shardInfo: z.object({}),
	listRooms: z.object({}),
	chatRoomCreate: ChatRoomDirectoryConfigSchema,
	chatRoomEnter: z.object({
		id: RoomIdSchema,
		password: z.string().optional(),
	}),
	chatRoomLeave: z.object({}),
	chatRoomUpdate: ChatRoomDirectoryUpdateSchema,
	//#endregion

	getDirectMessages: z.object({
		id: z.number().min(0),
		until: z.number().min(0).optional(),
	}),
	sendDirectMessage: z.object({
		id: z.number().min(0),
		content: z.string(),
		editing: z.number().min(0).optional(),
	}),
	directMessage: z.object({
		id: z.number().min(0),
		action: z.enum(['read', 'close']),
	}),

	//#region Management/admin endpoints; these require specific roles to be used

	// Account role assignment
	manageGetAccountRoles: z.object({
		id: z.number(),
	}),
	manageSetAccountRole: z.object({
		id: z.number(),
		role: ConfiguredAccountRoleSchema,
		expires: z.number().optional(),
	}),

	// Shard token management
	manageCreateShardToken: z.object({
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
	manageInvalidateShardToken: z.object({
		id: z.string(),
	}),
	manageListShardTokens: z.object({}),
	//#endregion
});

export type IClientDirectoryIn = z.infer<typeof ClientDirectoryInSchema>;

export type IClientDirectoryOut = {
	login: { result: 'verificationRequired' | 'invalidToken' | 'unknownCredentials'; } | {
		result: 'ok';
		token: { value: string; expires: number; };
		account: IDirectoryAccountInfo;
	},
	register: { result: 'ok' | 'usernameTaken' | 'emailTaken' | 'invalidBetaKey'; };
	resendVerificationEmail: { result: 'maybeSent'; };
	passwordReset: { result: 'maybeSent'; };
	passwordResetConfirm: { result: 'ok' | 'unknownCredentials'; };
	passwordChange: { result: 'ok' | 'invalidPassword'; };
	gitHubBind: { url: string; };
	listCharacters: {
		characters: ICharacterSelfInfo[];
		limit: number;
	};
	createCharacter: ShardConnection<ShardError | 'maxCharactersReached'>;
	updateCharacter: ICharacterSelfInfo;
	deleteCharacter: { result: 'ok' | 'characterInUse'; };
	connectCharacter: ShardConnection;
	shardInfo: { shards: IDirectoryShardInfo[]; };
	listRooms: { rooms: IChatRoomDirectoryInfo[]; };
	chatRoomCreate: ShardConnection<ShardError | 'nameTaken'>;
	chatRoomEnter: ShardConnection<'failed' | 'errFull' | 'notFound' | 'noAccess' | 'invalidPassword'>;
	chatRoomUpdate: { result: 'ok' | 'nameTaken' | 'notInRoom' | 'noAccess'; };
	getDirectMessages: { result: 'notFound' | 'denied'; } | {
		result: 'ok';
		account: IDirectoryDirectMessageAccount;
		messages: IDirectoryDirectMessage[];
	};
	sendDirectMessage: { result: 'ok' | 'notFound' | 'denied' | 'messageNotFound'; };
	manageGetAccountRoles: { result: 'notFound'; } | {
		result: 'ok';
		roles: IAccountRoleManageInfo;
	};
	manageSetAccountRole: { result: 'ok' | 'notFound'; };
	manageCreateShardToken: { result: 'adminRequired'; } | {
		result: 'ok';
		info: IShardTokenInfo;
		token: string;
	};
	manageInvalidateShardToken: { result: 'ok' | 'notFound'; };
	manageListShardTokens: { info: IShardTokenInfo[]; };
};

export type IClientDirectoryBase = DefineSocketInterface<IClientDirectoryIn, IClientDirectoryOut>;
export type IClientDirectory = SocketInterface<IClientDirectoryBase>;
export type IClientDirectoryArgument = RecordOnly<SocketInterfaceArgs<IClientDirectoryBase>>;
export type IClientDirectoryUnconfirmedArgument = SocketInterfaceUnconfirmedArgs<IClientDirectoryBase>;
export type IClientDirectoryResult = SocketInterfaceResult<IClientDirectoryBase>;
export type IClientDirectoryPromiseResult = SocketInterfacePromiseResult<IClientDirectoryBase>;
export type IClientDirectoryNormalResult = SocketInterfaceNormalResult<IClientDirectoryBase>;
export type IClientDirectoryResponseHandler = SocketInterfaceResponseHandler<IClientDirectoryBase>;
export type IClientDirectoryOneshotHandler = SocketInterfaceOneshotHandler<IClientDirectoryBase>;
export type IClientDirectoryMessageHandler<Context> = MessageHandler<IClientDirectoryBase, Context>;
