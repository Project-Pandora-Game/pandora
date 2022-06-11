import { IDirectoryCharacterConnectionInfo } from 'pandora-common';
import React, { createContext, ReactElement, useContext, useMemo } from 'react';
import { ChildrenProps } from '../../common/reactTypes';
import { ShardConnector } from '../../networking/shardConnector';
import { SocketIOShardConnector } from '../../networking/socketio_shard_connector';

export type ShardConnectorFactory = (info: IDirectoryCharacterConnectionInfo) => ShardConnector;

export interface ConnectorFactoryContext {
	shardConnectorFactory: ShardConnectorFactory;
}

export const connectorFactoryContext = createContext<ConnectorFactoryContext>({
	shardConnectorFactory: () => {
		throw new Error('Cannot create shard connector outside of connector factory context provider');
	},
});

/** Context provider responsible for providing concrete connector implementations to the application */
export function ConnectorFactoryContextProvider({ children }: ChildrenProps): ReactElement {
	const context = useMemo<ConnectorFactoryContext>(() => ({
		shardConnectorFactory: (info) => new SocketIOShardConnector(info),
	}), []);

	return (
		<connectorFactoryContext.Provider value={ context }>
			{ children }
		</connectorFactoryContext.Provider>
	);
}

export function useShardConnectorFactory(): ShardConnectorFactory {
	return useContext(connectorFactoryContext).shardConnectorFactory;
}
