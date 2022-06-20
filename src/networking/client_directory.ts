import type { SocketInterface, RecordOnly, SocketInterfaceArgs, SocketInterfaceUnconfirmedArgs, SocketInterfaceResult, SocketInterfaceResponseHandler, SocketInterfaceOneshotHandler, SocketInterfaceNormalResult, SocketInterfacePromiseResult } from './helpers';
import type { IDirectoryAccountInfo, IDirectoryAccountSettings, IDirectoryCharacterConnectionInfo, IDirectoryShardInfo } from './directory_client';
import type { MessageHandler } from './message_handler';
import type { IEmpty } from './empty';
import type { CharacterId, ICharacterDataId, ICharacterSelfInfo, ICharacterSelfInfoUpdate } from '../character';
import type { IChatRoomDirectoryConfig, IChatRoomDirectoryInfo, IChatRoomDirectoryUpdate, RoomId } from '../chatroom';
import { AccountRole, ConfiguredAccountRole, IAccountRoleManageInfo, IsAccountRole } from '../account';
import { CreateArrayValidator, CreateObjectValidator, CreateOneOfValidator } from '../validation';

type ShardError = 'noShardFound' | 'failed';

type ShardConnection<T = ShardError> = {
	result: T;
} | ({
	result: 'ok';
} & IDirectoryCharacterConnectionInfo);

export type IClientDirectoryAuthMessage = {
	username: string;
	token: string;
	character: null | {
		id: CharacterId;
		secret: string;
	};
};

export type IShardTokenType = 'stable' | 'beta' | 'testing' | 'development';

export const IsShardTokenType = CreateOneOfValidator<IShardTokenType>('stable', 'beta', 'testing', 'development');

export type IShardTokenInfo = {
	id: string;
	type: IShardTokenType;
	expires?: number;
	created: { id: number; username: string; time: number; };
};

export const IsDirectoryAccountSettings = CreateObjectValidator<Partial<IDirectoryAccountSettings>>({
	visibleRoles: CreateArrayValidator<AccountRole>({ validator: IsAccountRole }),
}, { noExtraKey: true, partial: true });

/** Client->Directory handlers */
interface ClientDirectory {
	//#region Before Login
	login(arg: { username: string; passwordSha512: string; verificationToken?: string; }): {
		result: 'verificationRequired' | 'invalidToken' | 'unknownCredentials',
	} | {
		result: 'ok',
		token: { value: string; expires: number; },
		account: IDirectoryAccountInfo,
	};
	register(arg: { username: string; passwordSha512: string; email: string; betaKey?: string; }): {
		result: 'ok' | 'usernameTaken' | 'emailTaken' | 'invalidBetaKey',
	};
	resendVerificationEmail(arg: { email: string; }): {
		result: 'maybeSent',
	};
	passwordReset(arg: { email: string; }): {
		result: 'maybeSent',
	};
	passwordResetConfirm(arg: { username: string; passwordSha512: string; token: string; }): {
		result: 'ok' | 'unknownCredentials',
	};
	//#endregion Before Login

	//#region Account management
	passwordChange(arg: { passwordSha512Old: string; passwordSha512New: string; }): {
		result: 'ok' | 'invalidPassword',
	};
	logout(arg: { invalidateToken?: string; }): void;
	gitHubBind(arg: { login: string; }): { url: string; };
	gitHubUnbind(_: IEmpty): void;
	changeSettings(arg: Partial<IDirectoryAccountSettings>): void;
	//#endregion

	//#region Character management
	listCharacters(_: IEmpty): {
		characters: ICharacterSelfInfo[];
		limit: number;
	};
	createCharacter(_: IEmpty): ShardConnection<ShardError | 'maxCharactersReached'>;
	updateCharacter(arg: ICharacterSelfInfoUpdate): ICharacterSelfInfo;
	deleteCharacter(arg: ICharacterDataId): { result: 'ok' | 'characterInUse'; };
	//#endregion

	//#region Character connection, shard interaction
	connectCharacter(arg: ICharacterDataId): ShardConnection;
	disconnectCharacter: (_: IEmpty) => void;
	shardInfo(_: IEmpty): {
		shards: IDirectoryShardInfo[],
	};
	listRooms(_: IEmpty): {
		rooms: IChatRoomDirectoryInfo[];
	};
	chatRoomCreate(arg: IChatRoomDirectoryConfig): ShardConnection<ShardError | 'nameTaken'>;
	chatRoomEnter(arg: {
		id: RoomId,
		password?: string,
	}): ShardConnection<'failed' | 'errFull' | 'notFound' | 'noAccess' | 'invalidPassword'>;
	chatRoomLeave(_: IEmpty): void;
	chatRoomUpdate(arg: IChatRoomDirectoryUpdate): {
		result: 'ok' | 'nameTaken' | 'notInRoom' | 'noAccess',
	};
	//#endregion

	//#region Management/admin endpoints; these require specific roles to be used

	// Account role assignment
	manageGetAccountRoles(arg: { id: number; }): { result: 'notFound'; } | {
		result: 'ok';
		roles: IAccountRoleManageInfo;
	};
	manageSetAccountRole(arg: {
		id: number;
		role: ConfiguredAccountRole;
		expires?: number;
	}): { result: 'ok' | 'notFound'; };

	// Shard token management
	manageCreateShardToken(arg: {
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
		type: IShardTokenType;
		/**
		 * If set, the token will expire at this time.
		 * If not set, the token will never expire.
		 * Directory may change this value.
		 */
		expires?: number;
	}): { result: 'adminRequired'; } | {
		result: 'ok';
		info: IShardTokenInfo;
		token: string;
	};
	manageInvalidateShardToken(arg: { id: string; }): { result: 'ok' | 'notFound'; };
	manageListShardTokens(_: IEmpty): { info: IShardTokenInfo[]; };

	//#endregion
}

export type IClientDirectory = SocketInterface<ClientDirectory>;
export type IClientDirectoryArgument = RecordOnly<SocketInterfaceArgs<ClientDirectory>>;
export type IClientDirectoryUnconfirmedArgument = SocketInterfaceUnconfirmedArgs<ClientDirectory>;
export type IClientDirectoryResult = SocketInterfaceResult<ClientDirectory>;
export type IClientDirectoryPromiseResult = SocketInterfacePromiseResult<ClientDirectory>;
export type IClientDirectoryNormalResult = SocketInterfaceNormalResult<ClientDirectory>;
export type IClientDirectoryResponseHandler = SocketInterfaceResponseHandler<ClientDirectory>;
export type IClientDirectoryOneshotHandler = SocketInterfaceOneshotHandler<ClientDirectory>;
export type IClientDirectoryMessageHandler<Context> = MessageHandler<ClientDirectory, Context>;
export type IClientDirectoryBase = ClientDirectory;
