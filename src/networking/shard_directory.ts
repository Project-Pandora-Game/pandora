import type { SocketInterface, RecordOnly, SocketInterfaceArgs, SocketInterfaceUnconfirmedArgs, SocketInterfaceResult, SocketInterfaceResponseHandler, SocketInterfaceOneshotHandler, SocketInterfaceNormalResult, SocketInterfacePromiseResult } from './helpers';
import type { MessageHandler } from './message_handler';
import type { CharacterId, ICharacterData, ICharacterDataAccess, ICharacterDataId, ICharacterDataUpdate } from '../character';
import { IShardCharacterDefinition } from './directory_shard';
import { IChatRoomFullInfo, IChatroomsLeaveReasonRecord } from '../chatroom';

export type ShardFeature = 'development';
const ShardFeatures: Record<ShardFeature, true> = {
	development: true,
};
export const ShardFeatureList: readonly ShardFeature[] = Object.keys(ShardFeatures) as ShardFeature[];

/** Shard->Directory handlers */
interface ShardDirectory {
	shardRegister: (args: {
		/** ID of the shard when re-connecting, null if new connection */
		shardId: string | null;
		publicURL: string;
		features: ShardFeature[];
		version: string;
		characters: IShardCharacterDefinition[];
		disconnectCharacters: CharacterId[];
		rooms: IChatRoomFullInfo[];
	}) => {
		shardId: string;
		/** List of characters connected to this shard (both outside and in room) */
		characters: IShardCharacterDefinition[];
		/** List of rooms which exist on this shard */
		rooms: IChatRoomFullInfo[];
		/** Dictionary of reasons why character was removed from room. Used to display specific messages (left, disconnected, kicked, ...) */
		roomLeaveReasons: IChatroomsLeaveReasonRecord;
	};
	characterDisconnect: (args: { id: CharacterId; reason: 'timeout' | 'error'; }) => void;

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
