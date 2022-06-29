import React, { ReactElement } from 'react';
import { ChildrenProps } from '../../common/reactTypes';
import { DebugContextProvider } from '../error/debugContextProvider';
import { RootErrorBoundary } from '../error/rootErrorBoundary';
import { ConnectorFactoryContextProvider } from './connectorFactoryContextProvider';
import { DirectoryConnectorContextProvider } from './directoryConnectorContextProvider';
import { NotificationContextProvider } from './notificationContextProvider';
import { StateContextProvider } from './stateContextProvider';
import { ShardConnectorContextProvider } from './shardConnectorContextProvider';

export function GameContextProvider({ children }: ChildrenProps): ReactElement {
	return (
		<DebugContextProvider>
			<RootErrorBoundary>
				<NotificationContextProvider>
					<StateContextProvider>
						<ConnectorFactoryContextProvider>
							<DirectoryConnectorContextProvider>
								<ShardConnectorContextProvider>
									{ children }
								</ShardConnectorContextProvider>
							</DirectoryConnectorContextProvider>
						</ConnectorFactoryContextProvider>
					</StateContextProvider>
				</NotificationContextProvider>
			</RootErrorBoundary>
		</DebugContextProvider>
	);
}
