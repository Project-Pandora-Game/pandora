import { noop } from 'lodash';
import { GetLogger, IDirectoryAccountInfo, IDirectoryClientChangeEvents } from 'pandora-common';
import React, { createContext, ReactElement, useContext, useEffect, useRef } from 'react';
import { ChildrenProps } from '../../common/reactTypes';
import { useErrorHandler } from '../../common/useErrorHandler';
import { IDirectoryConnector } from '../../networking/directoryConnector';
import { AuthToken, DirectoryConnector } from '../../networking/socketio_directory_connector';
import { useObservable } from '../../observable';

export const directoryConnectorContext = createContext<IDirectoryConnector>(DirectoryConnector);

const logger = GetLogger('DirectoryConnectorContextProvider');

const connectionPromise = DirectoryConnector.connect();

export function DirectoryConnectorContextProvider({ children }: ChildrenProps): ReactElement {
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

	return (
		<directoryConnectorContext.Provider value={ DirectoryConnector }>
			{ children }
		</directoryConnectorContext.Provider>
	);
}

export function useDirectoryConnector(): IDirectoryConnector {
	return useContext(directoryConnectorContext);
}

export function useDirectoryChangeListener(
	event: IDirectoryClientChangeEvents,
	callback: () => void,
	runImmediate = true,
): void {
	const directoryConnector = useDirectoryConnector();
	const callbackRef = useRef<() => void>(noop);

	useEffect(() => {
		callbackRef.current = callback;
	}, [callback, callbackRef]);

	useEffect(() => {
		if (runImmediate) {
			callbackRef.current();
		}
		return directoryConnector.changeEventEmitter.on(event, () => callbackRef.current());
	}, [directoryConnector.changeEventEmitter, event, callbackRef, runImmediate]);
}

export function useCurrentAccount(): IDirectoryAccountInfo | null {
	const directoryConnector = useDirectoryConnector();
	return useObservable(directoryConnector.currentAccount);
}

export function useAuthToken(): AuthToken | undefined {
	const directoryConnector = useDirectoryConnector();
	return useObservable(directoryConnector.authToken);
}
