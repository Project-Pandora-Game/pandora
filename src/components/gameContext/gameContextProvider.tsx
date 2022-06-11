import React, { ReactElement } from 'react';
import { ChildrenProps } from '../../common/reactTypes';
import { ConnectorFactoryContextProvider } from './connectorFactoryContextProvider';
import { DirectoryConnectorContextProvider } from './directoryConnectorContextProvider';
import { ShardConnectorContextProvider } from './shardConnectorContextProvider';

export function GameContextProvider({ children }: ChildrenProps): ReactElement {
	return (
		<ConnectorFactoryContextProvider>
			<DirectoryConnectorContextProvider>
				<ShardConnectorContextProvider>
					{ children }
				</ShardConnectorContextProvider>
			</DirectoryConnectorContextProvider>
		</ConnectorFactoryContextProvider>
	);
}
