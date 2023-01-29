import { CharacterId, ICharacterData, ICharacterDataUpdate, GetLogger, RoomId, IChatRoomData, IChatRoomDataUpdate } from 'pandora-common';
import type { ShardDatabase } from './databaseProvider';
import { DirectoryConnectionState, DirectoryConnector } from '../networking/socketio_directory_connector';
import _ from 'lodash';

const logger = GetLogger('db');

export default class DirectoryDatabase implements ShardDatabase {
	public async init(): Promise<this> {
		if (!DirectoryConnector) {
			logger.error('Directory connection not initialized');
			return Promise.resolve(this);
		}

		logger.info('Initialized Directory database');

		return Promise.resolve(this);
	}

	public async getCharacter(id: CharacterId, accessId: string): Promise<ICharacterData | null | false> {
		if (DirectoryConnector.state !== DirectoryConnectionState.CONNECTED)
			return false;

		return await DirectoryConnector.awaitResponse('getCharacter', { id, accessId });
	}

	public async setCharacter(data: ICharacterDataUpdate): Promise<boolean> {
		if (DirectoryConnector.state !== DirectoryConnectionState.CONNECTED)
			return false;

		const { result } = await DirectoryConnector.awaitResponse('setCharacter', data);

		return result === 'success';
	}

	public async getChatRoom(id: RoomId, accessId: string): Promise<Omit<IChatRoomData, 'config' | 'accessId' | 'owners'> | null | false> {
		if (DirectoryConnector.state !== DirectoryConnectionState.CONNECTED)
			return false;

		return _.omit(
			await DirectoryConnector.awaitResponse('getChatRoom', { id, accessId }),
			['config', 'accessId', 'owners'],
		);
	}

	public async setChatRoom(data: IChatRoomDataUpdate, accessId: string): Promise<boolean> {
		if (DirectoryConnector.state !== DirectoryConnectionState.CONNECTED)
			return false;

		const { result } = await DirectoryConnector.awaitResponse('setChatRoom', {
			data,
			accessId,
		});

		return result === 'success';
	}
}
