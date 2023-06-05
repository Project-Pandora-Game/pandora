import { GetLogger, IDirectoryCharacterConnectionInfo } from 'pandora-common';
import React, {
	createContext,
	Dispatch,
	ReactElement,
	SetStateAction,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from 'react';
import { ChildrenProps } from '../../common/reactTypes';
import { useDebugExpose } from '../../common/useDebugExpose';
import { useErrorHandler } from '../../common/useErrorHandler';
import { ShardConnector } from '../../networking/shardConnector';
import { LastSelectedCharacter, SocketIOShardConnector } from '../../networking/socketio_shard_connector';
import { useNullableObservable, useObservable } from '../../observable';
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
	const notify = useNotification(NotificationSource.CHAT_MESSAGE);

	const [shardConnector, setShardConnector] = useState<ShardConnector | null>(null);

	const contextData = useMemo<ShardConnectorContextData>(() => ({
		shardConnector,
		setShardConnector,
	}), [shardConnector]);

	const context = useMemo<ConnectorFactoryContext>(() => ({
		shardConnectorFactory: (info) => new SocketIOShardConnector(info),
	}), []);

	const chatRoom = shardConnector?.room;

	useEffect(() => {
		return chatRoom?.on('messageNotify', notify);
	}, [chatRoom, notify]);

	useDebugExpose('shardConnector', shardConnector);
	useDebugExpose('player', useNullableObservable(shardConnector?.player));
	useDebugExpose('chatRoom', chatRoom);

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
		return directoryConnector.connectionStateEventEmitter.on('connectionState', ({ character }) => {
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
	}, [directoryConnector, connectToShard, handleError, disconnectFromShard]);

	return <>{ children }</>;
}

export function useShardConnector(): ShardConnector | null {
	return useContext(shardConnectorContext).shardConnector;
}

export function useShardConnectionInfo(): IDirectoryCharacterConnectionInfo | null {
	const shardConnector = useShardConnector();
	return useNullableObservable(shardConnector?.connectionInfo);
}

function useShardConnectorFactory(): ShardConnectorFactory {
	return useContext(connectorFactoryContext).shardConnectorFactory;
}

export function useConnectToShard(): (info: IDirectoryCharacterConnectionInfo) => Promise<void> {
	const directoryConnector = useDirectoryConnector();
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
			directoryConnector.setShardConnectionInfo(info);

			setDebugData({ shardConnectionInfo: info });
			const newShardConnector = shardConnectorFactory(info);
			setShardConnector(newShardConnector);
			LastSelectedCharacter.value = info.characterId;
			await newShardConnector.connect();
		},
		[directoryConnector, shardConnector, disconnectFromShard, setShardConnector, shardConnectorFactory, setDebugData],
	);
}

function useDisconnectFromShard(): () => void {
	const shardConnector = useShardConnector();
	const setShardConnector = useSetShardConnector();

	return useCallback(() => {
		if (shardConnector) {
			shardConnector.disconnect();
			setShardConnector(null);
			LastSelectedCharacter.value = undefined;
		}
	}, [shardConnector, setShardConnector]);
}

function useSetShardConnector(): Dispatch<SetStateAction<ShardConnector | null>> {
	return useContext(shardConnectorContext).setShardConnector;
}
