import { ServiceManager } from 'pandora-common';
import type { ClientServices } from '../../services/clientServices';
import { EditorShardConnectionManagerServiceProvider } from './editorShardConnectionManager';

/**
 * Generates an un-initialized service manager containing all editor services.
 */
export function GenerateClientEditorServices(): ServiceManager<ClientServices> {
	return new ServiceManager<ClientServices>()
		.registerService(EditorShardConnectionManagerServiceProvider);
}
