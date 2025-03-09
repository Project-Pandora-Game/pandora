import { noop } from 'lodash';
import { AppearanceAction, IClientShardNormalResult, IDirectoryCharacterConnectionInfo, IShardClientChangeEvents } from 'pandora-common';
import {
	useEffect,
	useRef,
} from 'react';
import { useAssetManager } from '../../assets/assetManager';
import { GraphicsManagerInstance } from '../../assets/graphicsManager';
import { useDebugExpose } from '../../common/useDebugExpose';
import { useAsyncEvent } from '../../common/useEvent';
import { ShardConnector } from '../../networking/shardConnector';
import { useNullableObservable, useObservable } from '../../observable';
import { useAccountSettings } from '../../services/accountLogic/accountManagerHooks';
import { NotificationSource, useNotification } from '../../services/notificationHandler';
import { useService } from '../../services/serviceProvider';
import { useDebugContext } from '../error/debugContextProvider';
import { useDirectoryConnector } from './directoryConnectorContextProvider';
import { useGameStateOptional } from './gameStateContextProvider';

export function ShardConnectorContextProvider(): null {
	const directoryConnector = useDirectoryConnector();
	const directoryState = useObservable(directoryConnector.state);
	const directoryStatus = useObservable(directoryConnector.directoryStatus);

	const shardConnector = useShardConnector();
	const shardState = useNullableObservable(shardConnector?.state);
	const shardConnectionInfo = useNullableObservable(shardConnector?.connectionInfo);

	const { setDebugData } = useDebugContext();
	const notifyChatMessage = useNotification(NotificationSource.CHAT_MESSAGE);
	const notifyCharacterEntered = useNotification(NotificationSource.ROOM_ENTRY);

	const {
		notificationRoomEntrySound,
	} = useAccountSettings();

	const gameState = useNullableObservable(shardConnector?.gameState);

	useEffect(() => {
		return gameState?.on('messageNotify', notifyChatMessage);
	}, [gameState, notifyChatMessage]);

	useEffect(() => {
		return gameState?.on('characterEntered', () => {
			if (notificationRoomEntrySound !== '') {
				notifyCharacterEntered({});
			}
		});
	}, [gameState, notificationRoomEntrySound, notifyCharacterEntered]);

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
	return useObservable(useService('shardConnectionManager').shardConnector);
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

export function useShardConnectionInfo(): IDirectoryCharacterConnectionInfo | null {
	const shardConnector = useShardConnector();
	return useNullableObservable(shardConnector?.connectionInfo);
}
