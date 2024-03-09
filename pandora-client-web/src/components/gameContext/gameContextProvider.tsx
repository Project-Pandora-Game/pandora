import React, { ReactElement } from 'react';
import { ChildrenProps } from '../../common/reactTypes';
import { DebugContextProvider } from '../error/debugContextProvider';
import { RootErrorBoundary } from '../error/rootErrorBoundary';
import { DirectoryConnectorContextProvider } from './directoryConnectorContextProvider';
import { NotificationContextProvider } from './notificationContextProvider';
import { ShardConnectorContextProvider } from './shardConnectorContextProvider';
import { CharacterRestrictionOverrideDialogContext } from '../characterRestrictionOverride/characterRestrictionOverride';
import { ChatInputContextProvider } from '../../ui/components/chat/chatInput';
import { PermissionCheckServiceProvider } from './permissionCheckProvider';
import { AnchorAutoscroll } from '../../common/anchorAutoscroll';

export function GameContextProvider({ children }: ChildrenProps): ReactElement {
	return (
		<DebugContextProvider>
			<RootErrorBoundary>
				<NotificationContextProvider>
					<DirectoryConnectorContextProvider>
						<ShardConnectorContextProvider>
							<ChatInputContextProvider>
								<MiscProviders>
									{ children }
								</MiscProviders>
							</ChatInputContextProvider>
						</ShardConnectorContextProvider>
					</DirectoryConnectorContextProvider>
				</NotificationContextProvider>
			</RootErrorBoundary>
		</DebugContextProvider>
	);
}

function MiscProviders({ children }: ChildrenProps): ReactElement {
	return (
		<CharacterRestrictionOverrideDialogContext>
			<PermissionCheckServiceProvider>
				<AnchorAutoscroll />

				{ children }
			</PermissionCheckServiceProvider>
		</CharacterRestrictionOverrideDialogContext>
	);
}
