import { noop } from 'lodash-es';
import { AppearanceAction, IClientShardNormalResult, IShardClientChangeEvents } from 'pandora-common';
import {
	useEffect,
	useRef,
} from 'react';
import { useAssetManager } from '../../assets/assetManager.tsx';
import { GraphicsManagerInstance } from '../../assets/graphicsManager.ts';
import { useDebugExpose } from '../../common/useDebugExpose.ts';
import { useAsyncEvent } from '../../common/useEvent.ts';
import { ShardConnector } from '../../networking/shardConnector.ts';
import { useNullableObservable, useObservable } from '../../observable.ts';
import { useNavigatePandora } from '../../routing/navigate.ts';
import { useGameStateOptional } from '../../services/gameLogic/gameStateHooks.ts';
import { useGameLogicServiceOptional } from '../../services/serviceProvider.tsx';
import { useDebugContext } from '../error/debugContextProvider.tsx';
import { useDirectoryConnector } from './directoryConnectorContextProvider.tsx';

export function ShardConnectorContextProvider(): null {
	const navigate = useNavigatePandora();
	const directoryConnector = useDirectoryConnector();
	const directoryState = useObservable(directoryConnector.state);
	const directoryStatus = useObservable(directoryConnector.directoryStatus);

	const shardConnector = useShardConnector();
	const shardState = useNullableObservable(shardConnector?.state);
	const shardConnectionInfo = shardConnector?.connectionInfo;

	const { setDebugData } = useDebugContext();

	const gameState = useGameStateOptional();

	useEffect(() => {
		return gameState?.on('uiNavigate', (target) => {
			navigate(target);
		});
	}, [gameState, navigate]);

	useEffect(() => {
		setDebugData({
			directoryState,
			directoryStatus,
			shardState: shardState ?? undefined,
			shardConnectionInfo: shardConnectionInfo ?? undefined,
		});
	}, [directoryState, directoryStatus, shardState, shardConnectionInfo, setDebugData]);

	useDebugExpose('shardConnector', shardConnector);
	useDebugExpose('player', gameState?.player);
	useDebugExpose('gameState', gameState);

	useDebugExpose('assetManager', useAssetManager());
	useDebugExpose('graphicsManager', useObservable(GraphicsManagerInstance));

	return null;
}

export function useShardConnector(): ShardConnector | null {
	return useGameLogicServiceOptional('shardConnector');
}

export function useShardChangeListener(
	event: IShardClientChangeEvents | readonly IShardClientChangeEvents[],
	callback: () => void,
	runImmediate = true,
): void {
	const shardConnector = useShardConnector();
	const callbackRef = useRef<() => void>(noop);

	useEffect(() => {
		callbackRef.current = callback;
	}, [callback, callbackRef]);

	useEffect(() => {
		if (runImmediate) {
			callbackRef.current();
		}
		if (shardConnector == null)
			return undefined;

		if (typeof event === 'string') {
			return shardConnector.changeEventEmitter.on(event, () => callbackRef.current());
		} else {
			return shardConnector.changeEventEmitter.onAny((data) => {
				if (event.some((e) => data[e] !== undefined)) {
					callbackRef.current();
				}
			});
		}
	}, [shardConnector, event, callbackRef, runImmediate]);
}

export function useAppearanceActionEvent(action: AppearanceAction, handler: (result: IClientShardNormalResult['gameLogicAction'] | null) => void = () => { /** ignore */ }) {
	const gameState = useGameStateOptional();
	return useAsyncEvent(async () => {
		if (!gameState) {
			return null;
		}
		return await gameState.doImmediateAction(action);
	}, handler);
}
