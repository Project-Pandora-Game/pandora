import type { ServiceManager } from 'pandora-common';
import React, { ReactElement } from 'react';
import { AnchorAutoscroll } from '../../common/anchorAutoscroll';
import { ChildrenProps } from '../../common/reactTypes';
import type { ClientServices } from '../../services/clientServices';
import { ServiceManagerContextProvider } from '../../services/serviceProvider';
import { ChatInputContextProvider } from '../../ui/components/chat/chatInput';
import { CharacterRestrictionOverrideDialogContext } from '../characterRestrictionOverride/characterRestrictionOverride';
import { DebugContextProvider } from '../error/debugContextProvider';
import { RootErrorBoundary } from '../error/rootErrorBoundary';
import { DirectoryConnectorServices } from './directoryConnectorContextProvider';
import { NotificationContextProvider } from './notificationContextProvider';
import { PermissionCheckServiceProvider } from './permissionCheckProvider';
import { ShardConnectorContextProvider } from './shardConnectorContextProvider';

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
