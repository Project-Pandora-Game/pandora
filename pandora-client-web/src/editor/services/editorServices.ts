import { ServiceManager, type BaseServicesDefinition, type Satisfies } from 'pandora-common';
import type { ClientServices } from '../../services/clientServices.ts';
import { ScreenResolutionServiceProvider } from '../../services/screenResolution/screenResolution.ts';
import { EditorServiceProvider, type EditorService } from './editor.ts';
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
	return new ServiceManager<EditorServices>()
		.registerService(ScreenResolutionServiceProvider)
		.registerService(EditorServiceProvider)
		.registerService(EditorShardConnectionManagerServiceProvider);
}
