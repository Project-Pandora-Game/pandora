import {
	Assert,
	Service,
	type IService,
	type IShardClientArgument,
	type Satisfies,
	type ServiceConfigBase,
	type ServiceProviderDefinition,
} from 'pandora-common';
import { LoadAssetDefinitions } from '../../assets/assetManager.tsx';
import { GameState, GameStateImpl } from '../../components/gameContext/gameStateContextProvider.tsx';
import { Observable, type ReadonlyObservable } from '../../observable.ts';
import type { ClientGameLogicServices, ClientGameLogicServicesDependencies } from '../clientGameLogicServices.ts';

type GameStateManagerServiceConfig = Satisfies<{
	dependencies: Pick<ClientGameLogicServices, 'shardConnector'> & Pick<ClientGameLogicServicesDependencies, 'accountManager' | 'notificationHandler'>;
	events: false;
}, ServiceConfigBase>;

export interface IGameStateManager extends IService<GameStateManagerServiceConfig> {
	gameState: ReadonlyObservable<GameState | null>;
}

/** Class housing connection from Shard to Shard */
class GameStateManager extends Service<GameStateManagerServiceConfig> implements IGameStateManager {
	private readonly _gameState = new Observable<GameStateImpl | null>(null);

	public get gameState(): ReadonlyObservable<GameState | null> {
		return this._gameState;
	}

	protected override serviceInit(): void {
		const { shardConnector } = this.serviceDeps;

		shardConnector.messageHandlers.load = ({ character, space, globalState, assetsDefinition, assetsDefinitionHash, assetsSource }: IShardClientArgument['load']) => {
			shardConnector.markInitialDataReceived();

			LoadAssetDefinitions(assetsDefinitionHash, assetsDefinition, assetsSource);
			const currentGameState = this._gameState.value;
			if (currentGameState?.player.data.id === character.id) {
				currentGameState.player.update(character);
				currentGameState.onLoad({ globalState, space });
			} else {
				this._gameState.value = new GameStateImpl(shardConnector, this.serviceDeps, character, { globalState, space });
			}
		};
		shardConnector.messageHandlers.updateCharacter = (data: IShardClientArgument['updateCharacter']) => {
			const gameState = this._gameState.value;
			Assert(gameState != null, 'Received update data without game state');
			gameState.player.update(data);
		};
		shardConnector.messageHandlers.gameStateLoad = (data: IShardClientArgument['gameStateLoad']) => {
			const gameState = this._gameState.value;
			Assert(gameState != null, 'Received update data without game state');
			return gameState.onLoad(data);
		};
		shardConnector.messageHandlers.gameStateUpdate = (data: IShardClientArgument['gameStateUpdate']) => {
			const gameState = this._gameState.value;
			Assert(gameState != null, 'Received update data without game state');
			return gameState.onUpdate(data);
		};
		shardConnector.messageHandlers.chatMessage = (message: IShardClientArgument['chatMessage']) => {
			const gameState = this._gameState.value;
			Assert(gameState != null, 'Received chat message without game state');
			const lastTime = gameState.onMessage(message.messages);
			if (lastTime > 0) {
				shardConnector.sendMessage('chatMessageAck', { lastTime });
			}
		};
		shardConnector.messageHandlers.chatCharacterStatus = (status: IShardClientArgument['chatCharacterStatus']) => {
			const gameState = this._gameState.value;
			Assert(gameState != null, 'Received chat character status data without game state');
			return gameState.onStatus(status);
		};
		shardConnector.messageHandlers.permissionPrompt = (data: IShardClientArgument['permissionPrompt']) => {
			const gameState = this._gameState.value;
			Assert(gameState != null, 'Received permission prompt without game state');
			return gameState.onPermissionPrompt(data);
		};
	}
}

export const GameStateManagerServiceProvider: ServiceProviderDefinition<ClientGameLogicServices, 'gameState', GameStateManagerServiceConfig, ClientGameLogicServicesDependencies> = {
	name: 'gameState',
	ctor: GameStateManager,
	dependencies: {
		accountManager: true,
		notificationHandler: true,
		shardConnector: true,
	},
};
