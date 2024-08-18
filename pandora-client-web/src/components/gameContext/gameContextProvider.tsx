import React, { ReactElement } from 'react';
import { ChildrenProps } from '../../common/reactTypes';
import { DebugContextProvider } from '../error/debugContextProvider';
import { RootErrorBoundary } from '../error/rootErrorBoundary';
import { DirectoryConnectorServices } from './directoryConnectorContextProvider';
import { NotificationContextProvider } from './notificationContextProvider';
import { ShardConnectorContextProvider } from './shardConnectorContextProvider';
import { CharacterRestrictionOverrideDialogContext } from '../characterRestrictionOverride/characterRestrictionOverride';
import { ChatInputContextProvider } from '../../ui/components/chat/chatInput';
import { PermissionCheckServiceProvider } from './permissionCheckProvider';
import { AnchorAutoscroll } from '../../common/anchorAutoscroll';
import type { ServiceManager } from 'pandora-common';
import { ServiceManagerContextProvider } from '../../services/serviceProvider';

export interface GameContextProviderProps extends ChildrenProps {
	serviceManager: ServiceManager<ClientServices>;
}

export function GameContextProvider({ children, serviceManager }: GameContextProviderProps): ReactElement {
	return (
		<DebugContextProvider>
			<RootErrorBoundary>
				<ServiceManagerContextProvider serviceManager={ serviceManager }>
					<NotificationContextProvider>
						<ShardConnectorContextProvider>
							<ChatInputContextProvider>
								<MiscProviders>
									{ children }
								</MiscProviders>
							</ChatInputContextProvider>
						</ShardConnectorContextProvider>
					</NotificationContextProvider>
				</ServiceManagerContextProvider>
			</RootErrorBoundary>
		</DebugContextProvider>
	);
}

function MiscProviders({ children }: ChildrenProps): ReactElement {
	return (
		<CharacterRestrictionOverrideDialogContext>
			<PermissionCheckServiceProvider>
				<AnchorAutoscroll />
				<DirectoryConnectorServices />

				{ children }
			</PermissionCheckServiceProvider>
		</CharacterRestrictionOverrideDialogContext>
	);
}
