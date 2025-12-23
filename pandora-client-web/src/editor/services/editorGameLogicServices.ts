import { ServiceManager } from 'pandora-common';
import type { ClientGameLogicServices } from '../../services/clientGameLogicServices.ts';
import type { ClientServices } from '../../services/clientServices.ts';
import type { Editor } from '../editor.tsx';
import { EditorGameStateManagerServiceProvider } from './editorGameStateManager.ts';

export type ClientEditorGameLogicServicesDependencies = Omit<ClientServices, 'directoryConnector' | 'directMessageManager'> & {
	editor: Editor;
};

/**
 * Generates an un-initialized service manager containing all usermode services.
 */
export function GenerateClientEditorGameLogicServices(dependencies: ClientEditorGameLogicServicesDependencies): ServiceManager<ClientGameLogicServices, ClientEditorGameLogicServicesDependencies> {
	return new ServiceManager<ClientGameLogicServices, ClientEditorGameLogicServicesDependencies>(dependencies)
		// shardConnector is intentionally not provided
		.registerService(EditorGameStateManagerServiceProvider);
}
