import React, { ReactElement } from 'react';
import { AnchorAutoscroll } from '../../common/anchorAutoscroll';
import { ChildrenProps } from '../../common/reactTypes';
import { ChatInputContextProvider } from '../../ui/components/chat/chatInput';
import { TutorialService } from '../../ui/tutorial/tutorialSystem/tutorialService';
import { CharacterRestrictionOverrideDialogContext } from '../characterRestrictionOverride/characterRestrictionOverride';
import { DebugContextProvider } from '../error/debugContextProvider';
import { RootErrorBoundary } from '../error/rootErrorBoundary';
import { DirectoryConnectorContextProvider } from './directoryConnectorContextProvider';
import { NotificationContextProvider } from './notificationContextProvider';
import { PermissionCheckServiceProvider } from './permissionCheckProvider';
import { ShardConnectorContextProvider } from './shardConnectorContextProvider';

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
				<TutorialService />

				{ children }
			</PermissionCheckServiceProvider>
		</CharacterRestrictionOverrideDialogContext>
	);
}
