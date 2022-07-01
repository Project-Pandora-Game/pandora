import React, { ReactElement } from 'react';
import { ChildrenProps } from '../../common/reactTypes';
import { DebugContextProvider } from '../error/debugContextProvider';
import { RootErrorBoundary } from '../error/rootErrorBoundary';
import { DirectoryConnectorContextProvider } from './directoryConnectorContextProvider';
import { NotificationContextProvider } from './notificationContextProvider';
import { StateContextProvider } from './stateContextProvider';
import { ShardConnectorContextProvider } from './shardConnectorContextProvider';
import { Dialogs } from '../dialog/dialog';

export function GameContextProvider({ children }: ChildrenProps): ReactElement {
	return (
		<DebugContextProvider>
			<RootErrorBoundary>
				<Dialogs />
				<NotificationContextProvider>
					<StateContextProvider>
						<DirectoryConnectorContextProvider>
							<ShardConnectorContextProvider>
								{ children }
							</ShardConnectorContextProvider>
						</DirectoryConnectorContextProvider>
					</StateContextProvider>
				</NotificationContextProvider>
			</RootErrorBoundary>
		</DebugContextProvider>
	);
}
