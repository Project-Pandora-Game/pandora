import { CharacterId, ICharacterData, GetLogger, RoomId, IChatRoomData, IChatRoomDataShardUpdate, ICharacterDataShardUpdate } from 'pandora-common';
import type { ShardDatabase } from './databaseProvider';
import { DirectoryConnectionState, DirectoryConnector } from '../networking/socketio_directory_connector';
import _ from 'lodash';

const logger = GetLogger('db');

export default class DirectoryDatabase implements ShardDatabase {
	public init(): void {
		if (!DirectoryConnector)
			logger.error('Directory connection not initialized');
		else
			logger.info('Initialized Directory database');
	}

	public async getCharacter(id: CharacterId, accessId: string): Promise<ICharacterData | null | false> {
		if (DirectoryConnector.state !== DirectoryConnectionState.CONNECTED)
			return false;

		const { result } = await DirectoryConnector.awaitResponse('getCharacter', { id, accessId });
		return result;
	}

	public async setCharacter(id: CharacterId, data: ICharacterDataShardUpdate, accessId: string): Promise<boolean> {
		if (DirectoryConnector.state !== DirectoryConnectionState.CONNECTED)
			return false;

		const { result } = await DirectoryConnector.awaitResponse('setCharacter', { id, data, accessId });

		return result === 'success';
	}

	public async getChatRoom(id: RoomId, accessId: string): Promise<Omit<IChatRoomData, 'config' | 'accessId' | 'owners'> | null | false> {
		if (DirectoryConnector.state !== DirectoryConnectionState.CONNECTED)
			return false;

		const { result } = await DirectoryConnector.awaitResponse('getChatRoom', { id, accessId });

		if (result == null)
			return null;

		return _.omit(
			result,
			['config', 'accessId', 'owners'],
		);
	}

	public async setChatRoom(id: RoomId, data: IChatRoomDataShardUpdate, accessId: string): Promise<boolean> {
		if (DirectoryConnector.state !== DirectoryConnectionState.CONNECTED)
			return false;

		const { result } = await DirectoryConnector.awaitResponse('setChatRoom', {
			id,
			data,
			accessId,
		});

		return result === 'success';
	}
}
