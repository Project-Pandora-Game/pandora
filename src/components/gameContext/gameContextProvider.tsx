import { GetLogger, IDirectoryClientChangeEvents } from 'pandora-common';
import React, { createContext, ReactElement, useContext, useEffect, useMemo } from 'react';
import { ChildrenProps } from '../../common/reactTypes';
import { useErrorHandler } from '../../common/useErrorHandler';
import { IDirectoryConnector } from '../../networking/directoryConnector';
import { DirectoryConnector } from '../../networking/socketio_directory_connector';

export interface GameContextData {
	directoryConnector: IDirectoryConnector;
}

export const gameContext = createContext<GameContextData>({ directoryConnector: DirectoryConnector });

const logger = GetLogger('GameContextProvider');

const connectionPromise = DirectoryConnector.connect();

export function GameContextProvider({ children }: ChildrenProps): ReactElement {
	const errorHandler = useErrorHandler();

	useEffect(() => {
		void (async () => {
			try {
				await connectionPromise;
			} catch (error) {
				logger.fatal('Directory connection failed:', error);
				errorHandler(error);
			}
		})();
	}, [errorHandler]);

	const context = useMemo(() => ({
		directoryConnector: DirectoryConnector,
	}), []);

	return (
		<gameContext.Provider value={ context }>
			{ children }
		</gameContext.Provider>
	);
}

export function useGameContext(): GameContextData {
	return useContext(gameContext);
}

export function useDirectoryConnector(): IDirectoryConnector {
	return useGameContext().directoryConnector;
}

export function useDirectoryChangeListener(
	event: IDirectoryClientChangeEvents,
	callback: () => void,
	runImmediate = true,
): void {
	const directoryConnector = useDirectoryConnector();
	useEffect(() => {
		if (runImmediate) {
			callback();
		}
		return directoryConnector.changeEventEmitter.on(event, callback);
	}, [directoryConnector.changeEventEmitter, event, callback, runImmediate]);
}
