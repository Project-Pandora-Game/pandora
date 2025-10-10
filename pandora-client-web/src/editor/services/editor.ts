import {
	Service,
	type Satisfies,
	type ServiceConfigBase,
	type ServiceProviderDefinition,
} from 'pandora-common';
import { Observable } from '../../observable.ts';
import type { Editor } from '../editor.tsx';
import type { EditorServices } from './editorServices.ts';

type EditorServiceConfig = Satisfies<{
	dependencies: Pick<EditorServices, never>;
	events: false;
}, ServiceConfigBase>;

/**
 * Service containing main Editor instance.
 */
export class EditorService extends Service<EditorServiceConfig> {
	public readonly editor = new Observable<Editor | null>(null);
}

export const EditorServiceProvider: ServiceProviderDefinition<EditorServices, 'editor', EditorServiceConfig> = {
	name: 'editor',
	ctor: EditorService,
	dependencies: {
	},
};
