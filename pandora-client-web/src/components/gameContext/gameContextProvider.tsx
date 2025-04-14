import type { ServiceManager } from 'pandora-common';
import { ReactElement } from 'react';
import { AnchorAutoscroll } from '../../common/anchorAutoscroll.tsx';
import { ChildrenProps } from '../../common/reactTypes.ts';
import type { ClientServices } from '../../services/clientServices.ts';
import { ServiceManagerContextProvider } from '../../services/serviceProvider.tsx';
import { ChatInputContextProvider } from '../../ui/components/chat/chatInput.tsx';
import { CharacterPreviewAutogenerationService } from '../../ui/screens/room/characterPreviewGeneration.tsx';
import { RoomItemDialogsProvider } from '../../ui/screens/room/roomItemDialog.tsx';
import { TutorialService } from '../../ui/tutorial/tutorialSystem/tutorialService.tsx';
import { CharacterRestrictionOverrideDialogContext } from '../characterRestrictionOverride/characterRestrictionOverride.tsx';
import { DebugContextProvider } from '../error/debugContextProvider.tsx';
import { RootErrorBoundary } from '../error/rootErrorBoundary.tsx';
import { DirectoryConnectorServices } from './directoryConnectorContextProvider.tsx';
import { InterfaceSettingsProvider } from './interfaceSettingsProvider.tsx';
import { NotificationProvider } from './notificationProvider.tsx';
import { PermissionCheckServiceProvider } from './permissionCheckProvider.tsx';
import { SecondFactorProvider } from './secondFactorProvider.tsx';
import { ShardConnectorContextProvider } from './shardConnectorContextProvider.tsx';

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
				<RoomItemDialogsProvider />
				<CharacterPreviewAutogenerationService />

				{ children }
			</PermissionCheckServiceProvider>
		</CharacterRestrictionOverrideDialogContext>
	);
}
