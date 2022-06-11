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
import { Player } from '../../character/player';
import { ChildrenProps } from '../../common/reactTypes';
import { useErrorHandler } from '../../common/useErrorHandler';
import { ShardConnector } from '../../networking/shardConnector';
import { LastSelectedCharacter } from '../../networking/socketio_shard_connector';
import { useNullableObservable } from '../../observable';
import { useShardConnectorFactory } from './connectorFactoryContextProvider';
import { useDirectoryConnector } from './directoryConnectorContextProvider';

export interface ShardConnectorContextData {
	shardConnector: ShardConnector | null;
	setShardConnector: Dispatch<SetStateAction<ShardConnector | null>>;
}

export const shardConnectorContext = createContext<ShardConnectorContextData>({
	shardConnector: null,
	setShardConnector: () => {
		throw new Error('setShardConnector called outside of the ShardConnectorContextProvider');
	},
});

export function ShardConnectorContextProvider({ children }: ChildrenProps): ReactElement {
	const [shardConnector, setShardConnector] = useState<ShardConnector | null>(null);

	const contextData = useMemo<ShardConnectorContextData>(() => ({
		shardConnector,
		setShardConnector,
	}), [shardConnector]);

	return (
		<shardConnectorContext.Provider value={ contextData }>
			<ConnectionStateManager>
				{ children }
			</ConnectionStateManager>
		</shardConnectorContext.Provider>
	);
}

function ConnectionStateManager({ children }: ChildrenProps): ReactElement {
	const directoryConnector = useDirectoryConnector();
	const connectToShard = useConnectToShard();
	const handleError = useErrorHandler();
	const disconnectFromShard = useDisconnectFromShard();

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

export function useConnectToShard(): (info: IDirectoryCharacterConnectionInfo) => Promise<void> {
	const directoryConnector = useDirectoryConnector();
	const shardConnector = useShardConnector();
	const disconnectFromShard = useDisconnectFromShard();
	const setShardConnector = useSetShardConnector();
	const shardConnectorFactory = useShardConnectorFactory();

	return useCallback(async (info) => {
		if (shardConnector?.connectionInfoMatches(info)) {
			return;
		}
		disconnectFromShard();
		directoryConnector.setShardConnectionInfo(info);

		const newShardConnector = shardConnectorFactory(info);
		setShardConnector(newShardConnector);
		LastSelectedCharacter.value = info.characterId;
		await newShardConnector.connect();
	}, [directoryConnector, shardConnector, disconnectFromShard, setShardConnector, shardConnectorFactory]);
}

function useDisconnectFromShard(): () => void {
	const shardConnector = useShardConnector();
	const setShardConnector = useSetShardConnector();

	return useCallback(() => {
		if (shardConnector) {
			shardConnector.disconnect();
			setShardConnector(null);
			Player.value = null;
			LastSelectedCharacter.value = undefined;
		}
	}, [shardConnector, setShardConnector]);
}

function useSetShardConnector(): Dispatch<SetStateAction<ShardConnector | null>> {
	return useContext(shardConnectorContext).setShardConnector;
}
