import { ServiceManager, type BaseServicesDefinition, type Satisfies } from 'pandora-common';
import { AudioServiceProvider } from '../../services/audio.ts';
import { BrowserPermissionManagerServiceProvider } from '../../services/browserPermissionManager.ts';
import type { ClientServices } from '../../services/clientServices.ts';
import { NotificationHandlerServiceProvider } from '../../services/notificationHandler.tsx';
import { ScreenResolutionServiceProvider } from '../../services/screenResolution/screenResolution.ts';
import { UserActivationServiceProvider } from '../../services/userActivation.ts';
import { EditorServiceProvider, type EditorService } from './editor.ts';
import { EditorAccountManagerServiceProvider } from './editorAccountManager.ts';
import { EditorShardConnectionManagerServiceProvider } from './editorShardConnectionManager.ts';

/** Services available on Padora's client, when running in normal user mode. */
export type EditorServices = Satisfies<
	ClientServices &
	{
		editor: EditorService;
	},
	BaseServicesDefinition
>;

/**
 * Generates an un-initialized service manager containing all editor services.
 */
export function GenerateClientEditorServices(): ServiceManager<EditorServices> {
	return new ServiceManager<EditorServices>({})
		.registerService(ScreenResolutionServiceProvider)
		.registerService(EditorServiceProvider) // Extra in Editor only
		.registerService(BrowserPermissionManagerServiceProvider)
		.registerService(UserActivationServiceProvider)
		.registerService(AudioServiceProvider)
		// directoryConnector is intentionally not provided
		.registerService(EditorAccountManagerServiceProvider)
		.registerService(NotificationHandlerServiceProvider)
		// directMessageManager is intentionally not provided
		.registerService(EditorShardConnectionManagerServiceProvider); // Editor-specific shardConnectionManager
}
