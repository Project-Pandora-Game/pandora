import { noop } from 'lodash';
import { AppearanceAction, GetLogger, IClientShardNormalResult, IDirectoryCharacterConnectionInfo, IShardClientChangeEvents } from 'pandora-common';
import React, {
	Dispatch,
	ReactElement,
	SetStateAction,
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import { ChildrenProps } from '../../common/reactTypes';
import { useDebugExpose } from '../../common/useDebugExpose';
import { useErrorHandler } from '../../common/useErrorHandler';
import { useAsyncEvent } from '../../common/useEvent';
import { ShardConnector } from '../../networking/shardConnector';
import { SocketIOConnector } from '../../networking/socketio_connector';
import { useNullableObservable, useObservable } from '../../observable';
import { useAccountSettings } from '../../services/accountLogic/accountManagerHooks';
import { useService } from '../../services/serviceProvider';
import { useDebugContext } from '../error/debugContextProvider';
import { useDirectoryConnector } from './directoryConnectorContextProvider';
import { NotificationSource, useNotification } from './notificationContextProvider';

export interface ShardConnectorContextData {
	shardConnector: ShardConnector | null;
	setShardConnector: Dispatch<SetStateAction<ShardConnector | null>>;
}

export type ShardConnectorFactory = (info: IDirectoryCharacterConnectionInfo) => ShardConnector;

export interface ConnectorFactoryContext {
	shardConnectorFactory: ShardConnectorFactory;
}

export const shardConnectorContext = createContext<ShardConnectorContextData>({
	shardConnector: null,
	setShardConnector: () => {
		throw new Error('setShardConnector called outside of the ShardConnectorContextProvider');
	},
});

export const connectorFactoryContext = createContext<ConnectorFactoryContext>({
	shardConnectorFactory: () => {
		throw new Error('Cannot create shard connector outside of connector factory context provider');
	},
});

export function ShardConnectorContextProvider({ children }: ChildrenProps): ReactElement {
	const notifyChatMessage = useNotification(NotificationSource.CHAT_MESSAGE);
	const notifyCharacterEntered = useNotification(NotificationSource.ROOM_ENTRY);
	const directoryConnector = useDirectoryConnector();

	const {
		notificationRoomEntry,
	} = useAccountSettings();

	const [shardConnector, setShardConnector] = useState<ShardConnector | null>(null);

	const contextData = useMemo<ShardConnectorContextData>(() => ({
		shardConnector,
		setShardConnector,
	}), [shardConnector]);

	const context = useMemo<ConnectorFactoryContext>(() => ({
		shardConnectorFactory: (info) => new ShardConnector(info, directoryConnector),
	}), [directoryConnector]);

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

	useDebugExpose('shardConnector', shardConnector);
	useDebugExpose('player', gameState?.player);
	useDebugExpose('gameState', gameState);

	return (
		<connectorFactoryContext.Provider value={ context }>
			<shardConnectorContext.Provider value={ contextData }>
				<ConnectionStateManager>
					{ children }
				</ConnectionStateManager>
			</shardConnectorContext.Provider>
		</connectorFactoryContext.Provider>
	);
}

function ConnectionStateManager({ children }: ChildrenProps): ReactElement {
	const directoryConnector = useDirectoryConnector();
	const accountManager = useService('accountManager');
	const shardConnector = useShardConnector();
	const connectToShard = useConnectToShard();
	const handleError = useErrorHandler();
	const disconnectFromShard = useDisconnectFromShard();
	const { setDebugData } = useDebugContext();
	const directoryState = useObservable(directoryConnector.state);
	const directoryStatus = useObservable(directoryConnector.directoryStatus);
	const shardState = useNullableObservable(shardConnector?.state);

	useEffect(() => {
		setDebugData({
			directoryState,
			directoryStatus,
			shardState: shardState ?? undefined,
		});
	}, [directoryState, directoryStatus, shardState, setDebugData]);

	useEffect(() => {
		return accountManager.on('accountChanged', ({ character }) => {
			void (async () => {
				try {
					if (character) {
						await connectToShard(character);
					} else {
						disconnectFromShard();
					}
				} catch (error) {
					GetLogger('ConnectionStateManager').fatal('Error while connecting to shard', error);
					handleError(error);
				}
			})();
		});
	}, [accountManager, connectToShard, handleError, disconnectFromShard]);

	return <>{ children }</>;
}

export function useShardConnector(): ShardConnector | null {
	return useContext(shardConnectorContext).shardConnector;
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

function useShardConnectorFactory(): ShardConnectorFactory {
	return useContext(connectorFactoryContext).shardConnectorFactory;
}

export function useConnectToShard(): (info: IDirectoryCharacterConnectionInfo) => Promise<void> {
	const shardConnector = useShardConnector();
	const disconnectFromShard = useDisconnectFromShard();
	const setShardConnector = useSetShardConnector();
	const shardConnectorFactory = useShardConnectorFactory();
	const { setDebugData } = useDebugContext();

	return useCallback(
		async (info) => {
			if (shardConnector?.connectionInfoMatches(info)) {
				return;
			}
			disconnectFromShard();

			setDebugData({ shardConnectionInfo: info });
			const newShardConnector = shardConnectorFactory(info);
			const connectPromise = newShardConnector.connect(SocketIOConnector);
			setShardConnector(newShardConnector);
			await connectPromise;
		},
		[shardConnector, disconnectFromShard, setShardConnector, shardConnectorFactory, setDebugData],
	);
}

function useDisconnectFromShard(): () => void {
	const shardConnector = useShardConnector();
	const setShardConnector = useSetShardConnector();

	return useCallback(() => {
		if (shardConnector) {
			shardConnector.disconnect();
			setShardConnector(null);
		}
	}, [shardConnector, setShardConnector]);
}

function useSetShardConnector(): Dispatch<SetStateAction<ShardConnector | null>> {
	return useContext(shardConnectorContext).setShardConnector;
}
