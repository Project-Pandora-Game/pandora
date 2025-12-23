import {
	GetLogger,
	Service,
	type Satisfies,
	type ServiceConfigBase,
	type ServiceManager,
	type ServiceProvider,
	type ServiceProviderDefinition,
} from 'pandora-common';
import { Observable, type ReadonlyObservable } from '../../observable.ts';
import type { ClientGameLogicServices, ClientGameLogicServicesDependencies } from '../../services/clientGameLogicServices.ts';
import type { IShardConnectionManager } from '../../services/shardConnectionManager.ts';
import { GenerateClientEditorGameLogicServices } from './editorGameLogicServices.ts';
import type { EditorServices } from './editorServices.ts';

type EditorShardConnectionManagerServiceConfig = Satisfies<{
	dependencies: Omit<EditorServices, 'shardConnectionManager' | 'directoryConnector' | 'directMessageManager'>;
	events: false;
}, ServiceConfigBase>;

/**
 * Service containing fake data for editor "shard" connection.
 */
export class EditorShardConnectionManager extends Service<EditorShardConnectionManagerServiceConfig> implements IShardConnectionManager {
	private readonly _gameLogicServices = new Observable<ServiceManager<ClientGameLogicServices, ClientGameLogicServicesDependencies> | null>(null);

	public get gameLogicServices(): ReadonlyObservable<ServiceProvider<ClientGameLogicServices> | null> {
		return this._gameLogicServices;
	}

	protected override serviceInit(): void {
		this.serviceDeps.editor.editor.subscribe((editor) => {
			if (editor != null) {
				const gameLogicServices = GenerateClientEditorGameLogicServices({
					...this.serviceDeps,
					shardConnectionManager: this,
					editor,
				});

				gameLogicServices.load()
					.then(() => {
						if (this.serviceDeps.editor.editor.value === editor) {
							this._gameLogicServices.value = gameLogicServices;
						}
					})
					.catch((err) => {
						GetLogger('EditorShardConnectionManager').error('Error loading game logic services:', err);
					});
			} else {
				this._gameLogicServices.value = null;
			}
		}, true);
	}
}

export const EditorShardConnectionManagerServiceProvider: ServiceProviderDefinition<EditorServices, 'shardConnectionManager', EditorShardConnectionManagerServiceConfig> = {
	name: 'shardConnectionManager',
	ctor: EditorShardConnectionManager,
	dependencies: {
		editor: true,

		screenResolution: true,
		browserPermissionManager: true,
		userActivation: true,
		audio: true,
		// directoryConnector: true,
		accountManager: true,
		notificationHandler: true,
		// directMessageManager: true,
	},
};
