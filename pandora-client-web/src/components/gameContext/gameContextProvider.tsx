import React, { ReactElement } from 'react';
import { ChildrenProps } from '../../common/reactTypes';
import { DebugContextProvider } from '../error/debugContextProvider';
import { RootErrorBoundary } from '../error/rootErrorBoundary';
import { DirectoryConnectorContextProvider } from './directoryConnectorContextProvider';
import { NotificationContextProvider } from './notificationContextProvider';
import { ShardConnectorContextProvider } from './shardConnectorContextProvider';
import { Dialogs } from '../dialog/dialog';
import { CharacterSafemodeDialogContext } from '../characterSafemode/characterSafemode';

export function GameContextProvider({ children }: ChildrenProps): ReactElement {
	return (
		<DebugContextProvider>
			<RootErrorBoundary>
				<Dialogs />
				<NotificationContextProvider>
					<DirectoryConnectorContextProvider>
						<ShardConnectorContextProvider>
							<MiscProviders>
								{ children }
							</MiscProviders>
						</ShardConnectorContextProvider>
					</DirectoryConnectorContextProvider>
				</NotificationContextProvider>
			</RootErrorBoundary>
		</DebugContextProvider>
	);
}

function MiscProviders({ children }: ChildrenProps): ReactElement {
	return (
		<CharacterSafemodeDialogContext>
			{ children }
		</CharacterSafemodeDialogContext>
	);
}
