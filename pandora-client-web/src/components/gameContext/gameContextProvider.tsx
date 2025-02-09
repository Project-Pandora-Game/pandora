import type { ServiceManager } from 'pandora-common';
import { ReactElement } from 'react';
import { AnchorAutoscroll } from '../../common/anchorAutoscroll';
import { ChildrenProps } from '../../common/reactTypes';
import type { ClientServices } from '../../services/clientServices';
import { ServiceManagerContextProvider } from '../../services/serviceProvider';
import { ChatInputContextProvider } from '../../ui/components/chat/chatInput';
import { TutorialService } from '../../ui/tutorial/tutorialSystem/tutorialService';
import { CharacterRestrictionOverrideDialogContext } from '../characterRestrictionOverride/characterRestrictionOverride';
import { DebugContextProvider } from '../error/debugContextProvider';
import { RootErrorBoundary } from '../error/rootErrorBoundary';
import { DirectoryConnectorServices } from './directoryConnectorContextProvider';
import { InterfaceSettingsProvider } from './interfaceSettingsProvider';
import { NotificationProvider } from './notificationProvider';
import { PermissionCheckServiceProvider } from './permissionCheckProvider';
import { SecondFactorProvider } from './secondFactorProvider';
import { ShardConnectorContextProvider } from './shardConnectorContextProvider';

export interface GameContextProviderProps extends ChildrenProps {
	serviceManager: ServiceManager<ClientServices>;
}

export function GameContextProvider({ children, serviceManager }: GameContextProviderProps): ReactElement {
	return (
		<DebugContextProvider>
			<RootErrorBoundary>
				<ServiceManagerContextProvider serviceManager={ serviceManager }>
					<ChatInputContextProvider>
						<MiscProviders>
							{ children }
						</MiscProviders>
					</ChatInputContextProvider>
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
				<SecondFactorProvider />
				<NotificationProvider />
				<ShardConnectorContextProvider />
				<TutorialService />
				<InterfaceSettingsProvider />

				{ children }
			</PermissionCheckServiceProvider>
		</CharacterRestrictionOverrideDialogContext>
	);
}
