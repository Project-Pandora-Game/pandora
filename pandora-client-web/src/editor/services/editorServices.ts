import { ServiceManager } from 'pandora-common';
import type { ClientServices } from '../../services/clientServices.ts';
import { ScreenResolutionServiceProvider } from '../../services/screenResolution/screenResolution.ts';
import { EditorShardConnectionManagerServiceProvider } from './editorShardConnectionManager.ts';

/**
 * Generates an un-initialized service manager containing all editor services.
 */
export function GenerateClientEditorServices(): ServiceManager<ClientServices> {
	return new ServiceManager<ClientServices>()
		.registerService(ScreenResolutionServiceProvider)
		.registerService(EditorShardConnectionManagerServiceProvider);
}
