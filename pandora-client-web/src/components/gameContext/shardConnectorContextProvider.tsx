import { noop } from 'lodash';
import { AppearanceAction, IClientShardNormalResult, IDirectoryCharacterConnectionInfo, IShardClientChangeEvents } from 'pandora-common';
import {
	useEffect,
	useRef,
} from 'react';
import { useDebugExpose } from '../../common/useDebugExpose';
import { useAsyncEvent } from '../../common/useEvent';
import { ShardConnector } from '../../networking/shardConnector';
import { useNullableObservable, useObservable } from '../../observable';
import { useAccountSettings } from '../../services/accountLogic/accountManagerHooks';
import { NotificationSource, useNotification } from '../../services/notificationHandler';
import { useService } from '../../services/serviceProvider';
import { useDebugContext } from '../error/debugContextProvider';
import { useDirectoryConnector } from './directoryConnectorContextProvider';

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
		notificationRoomEntry,
	} = useAccountSettings();

	const gameState = useNullableObservable(shardConnector?.gameState);

	useEffect(() => {
		return gameState?.on('messageNotify', notifyChatMessage);
	}, [gameState, notifyChatMessage]);

	useEffect(() => {
		return gameState?.on('characterEntered', () => {
			if (notificationRoomEntry) {
				notifyCharacterEntered({});
			}
		});
	}, [gameState, notificationRoomEntry, notifyCharacterEntered]);

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

	return null;
}

export function useShardConnector(): ShardConnector | null {
	return useObservable(useService('shardConnectionManager').shardConnector);
}

export function useShardChangeListener(
	event: IShardClientChangeEvents,
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
		return shardConnector.changeEventEmitter.on(event, () => callbackRef.current());
	}, [shardConnector, event, callbackRef, runImmediate]);
}

export function useAppearanceActionEvent(action: AppearanceAction, handler: (result: IClientShardNormalResult['appearanceAction'] | null) => void = () => { /** ignore */ }) {
	const shardConnector = useShardConnector();
	return useAsyncEvent(async () => {
		if (!shardConnector) {
			return null;
		}
		return await shardConnector.awaitResponse('appearanceAction', action);
	}, handler);
}

export function useShardConnectionInfo(): IDirectoryCharacterConnectionInfo | null {
	const shardConnector = useShardConnector();
	return useNullableObservable(shardConnector?.connectionInfo);
}
