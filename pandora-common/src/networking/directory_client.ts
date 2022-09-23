import { z } from 'zod';
import { IAccountRoleInfo, AccountRoleSchema } from '../account';
import type { CharacterId } from '../character';
import type { ShardFeature } from '../chatroom';
import type { SocketInterface, RecordOnly, SocketInterfaceArgs, SocketInterfaceUnconfirmedArgs, SocketInterfaceResult, SocketInterfaceResponseHandler, SocketInterfaceOneshotHandler, SocketInterfaceNormalResult, SocketInterfacePromiseResult } from './helpers';
import type { MessageHandler } from './message_handler';

export type IDirectoryStatus = {
	time: number;
	betaKeyRequired?: true;
};

export const DirectoryAccountSettingsSchema = z.object({
	visibleRoles: z.array(AccountRoleSchema),
	labelColor: z.string(),
});
export type IDirectoryAccountSettings = z.infer<typeof DirectoryAccountSettingsSchema>;

export type IDirectoryAccountInfo = {
	id: number;
	username: string;
	created: number;
	github?: { id: number; login: string; };
	roles?: IAccountRoleInfo;
	settings: IDirectoryAccountSettings;
	cryptoKey?: string;
};

export type IDirectoryShardInfo = {
	id: string;
	publicURL: string;
	features: ShardFeature[];
	version: string;
};

export type IDirectoryCharacterConnectionInfo = {
	characterId: CharacterId;
	secret: string;
} & IDirectoryShardInfo;

export type IDirectoryClientChangeEvents = 'characterList' | 'shardList' | 'roomList';

/** Directory->Client handlers */
interface DirectoryClient {
	/** Generic message for Directory's current status */
	serverStatus(arg: IDirectoryStatus): void;

	connectionState(arg: {
		account: IDirectoryAccountInfo | null,
		character: IDirectoryCharacterConnectionInfo | null,
		unreadDirectMessages: number[],
	}): void;
	somethingChanged(arg: {
		changes: IDirectoryClientChangeEvents[];
	}): void;
	newDirectMessage(arg: {
		account: {
			id: number;
			name: string;
			labelColor: string;
			publicKeyData: string;
		};
		time: number;
		message: string;
		edited?: number;
	}): void;
}

export type IDirectoryClient = SocketInterface<DirectoryClient>;
export type IDirectoryClientArgument = RecordOnly<SocketInterfaceArgs<DirectoryClient>>;
export type IDirectoryClientUnconfirmedArgument = SocketInterfaceUnconfirmedArgs<DirectoryClient>;
export type IDirectoryClientResult = SocketInterfaceResult<DirectoryClient>;
export type IDirectoryClientPromiseResult = SocketInterfacePromiseResult<DirectoryClient>;
export type IDirectoryClientNormalResult = SocketInterfaceNormalResult<DirectoryClient>;
export type IDirectoryClientResponseHandler = SocketInterfaceResponseHandler<DirectoryClient>;
export type IDirectoryClientOneshotHandler = SocketInterfaceOneshotHandler<DirectoryClient>;
export type IDirectoryClientMessageHandler<Context> = MessageHandler<DirectoryClient, Context>;
export type IDirectoryClientBase = DirectoryClient;
