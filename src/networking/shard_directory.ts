import type { SocketInterface, RecordOnly, SocketInterfaceArgs, SocketInterfaceUnconfirmedArgs, SocketInterfaceResult, SocketInterfaceResponseHandler, SocketInterfaceOneshotHandler, SocketInterfaceNormalResult, SocketInterfacePromiseResult } from './helpers';
import type { MessageHandler } from './message_handler';
import type { ICharacterData, ICharacterDataAccess, ICharacterDataId, ICharacterDataUpdate } from '../character';
import { IShardCharacterDefinition } from './directory_shard';

export type ShardFeature = 'development';

/** Shard->Directory handlers */
interface ShardDirectory {
	shardRegister: (args: {
		/** ID of the shard when re-connecting, null if new connection */
		shardId: string | null;
		publicURL: string;
		features: ShardFeature[];
		version: string;
		characters: IShardCharacterDefinition[];
	}) => {
		shardId: string;
		characters: IShardCharacterDefinition[];
	};
	characterDisconnected: (args: ICharacterDataId) => void;

	createCharacter: (args: ICharacterDataId) => ICharacterData;

	//#region Database
	getCharacter: (args: ICharacterDataAccess) => ICharacterData;
	setCharacter: (args: ICharacterDataUpdate) => { result: 'success' | 'invalidAccessId'; };
	//#endregion
}

export type IShardDirectory = SocketInterface<ShardDirectory>;
export type IShardDirectoryArgument = RecordOnly<SocketInterfaceArgs<ShardDirectory>>;
export type IShardDirectoryUnconfirmedArgument = SocketInterfaceUnconfirmedArgs<ShardDirectory>;
export type IShardDirectoryResult = SocketInterfaceResult<ShardDirectory>;
export type IShardDirectoryPromiseResult = SocketInterfacePromiseResult<ShardDirectory>;
export type IShardDirectoryNormalResult = SocketInterfaceNormalResult<ShardDirectory>;
export type IShardDirectoryResponseHandler = SocketInterfaceResponseHandler<ShardDirectory>;
export type IShardDirectoryOneshotHandler = SocketInterfaceOneshotHandler<ShardDirectory>;
export type IShardDirectoryMessageHandler<Context> = MessageHandler<ShardDirectory, Context>;
export type IShardDirectoryBase = ShardDirectory;
