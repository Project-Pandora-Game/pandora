import {
	Service,
	type Satisfies,
	type ServiceConfigBase,
	type ServiceProviderDefinition,
} from 'pandora-common';
import { GameState } from '../../components/gameContext/gameStateContextProvider.tsx';
import { Observable, type ReadonlyObservable } from '../../observable.ts';
import type { ClientGameLogicServices } from '../../services/clientServices.ts';
import type { IGameStateManager } from '../../services/gameLogic/gameStateManager.ts';
import { EditorGameStateProxy } from '../editorGameState.ts';
import type { ClientEditorGameLogicServicesDependencies } from './editorServices.ts';

type EditorGameStateManagerServiceConfig = Satisfies<{
	dependencies: Pick<ClientEditorGameLogicServicesDependencies, 'editor'>;
	events: false;
}, ServiceConfigBase>;

/** Class housing connection from Shard to Shard */
class EditorGameStateManager extends Service<EditorGameStateManagerServiceConfig> implements IGameStateManager {
	private readonly _gameState = new Observable<EditorGameStateProxy | null>(null);

	public get gameState(): ReadonlyObservable<GameState | null> {
		return this._gameState;
	}

	protected override serviceInit(): void {
		this._gameState.value = new EditorGameStateProxy(this.serviceDeps.editor);
	}
}

export const EditorGameStateManagerServiceProvider: ServiceProviderDefinition<ClientGameLogicServices, 'gameState', EditorGameStateManagerServiceConfig, ClientEditorGameLogicServicesDependencies> = {
	name: 'gameState',
	ctor: EditorGameStateManager,
	dependencies: {
		editor: true,
	},
};
