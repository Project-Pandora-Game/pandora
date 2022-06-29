import { IDirectoryCharacterConnectionInfo } from 'pandora-common';
import React, { createContext, ReactElement, useContext, useMemo } from 'react';
import { ChildrenProps } from '../../common/reactTypes';
import { DIRECTORY_ADDRESS } from '../../config/Environment';
import { DirectoryConnector } from '../../networking/directoryConnector';
import { ShardConnector } from '../../networking/shardConnector';
import { SocketIODirectoryConnector } from '../../networking/socketio_directory_connector';
import { SocketIOShardConnector } from '../../networking/socketio_shard_connector';
import { useChatRoomHandler } from './chatRoomContextProvider';
import { usePlayerContext } from './playerContextProvider';

export type ShardConnectorFactory = (info: IDirectoryCharacterConnectionInfo) => ShardConnector;

export interface ConnectorFactoryContext {
	shardConnectorFactory: ShardConnectorFactory;
}

export const connectorFactoryContext = createContext<ConnectorFactoryContext>({
	shardConnectorFactory: () => {
		throw new Error('Cannot create shard connector outside of connector factory context provider');
	},
});

/** Context provider responsible for providing concrete shard connector implementations to the application */
export function ConnectorFactoryContextProvider({ children }: ChildrenProps): ReactElement {
	const player = usePlayerContext();
	const room = useChatRoomHandler();
	const context = useMemo<ConnectorFactoryContext>(() => ({
		shardConnectorFactory: (info) => new SocketIOShardConnector(info, player, room),
	}), [player, room]);

	return (
		<connectorFactoryContext.Provider value={ context }>
			{ children }
		</connectorFactoryContext.Provider>
	);
}

export function useShardConnectorFactory(): ShardConnectorFactory {
	return useContext(connectorFactoryContext).shardConnectorFactory;
}

/** Factory function responsible for providing the concrete directory connector implementation to the application */
export function CreateDirectoryConnector(): DirectoryConnector {
	if (!DIRECTORY_ADDRESS) {
		throw new Error('Unable to create directory connector: missing DIRECTORY_ADDRESS');
	}

	return SocketIODirectoryConnector.create(DIRECTORY_ADDRESS);
}
