import { noop } from 'lodash';
import { GetLogger, IDirectoryAccountInfo, IDirectoryClientChangeEvents } from 'pandora-common';
import React, { createContext, ReactElement, useContext, useEffect, useRef } from 'react';
import { ChildrenProps } from '../../common/reactTypes';
import { useErrorHandler } from '../../common/useErrorHandler';
import { AuthToken, DirectoryConnector } from '../../networking/directoryConnector';
import { UnimplementedDirectoryConnector } from '../../networking/unimplementedDirectoryConnector';
import { useObservable } from '../../observable';
import { CreateDirectoryConnector } from './connectorFactoryContextProvider';

let directoryConnectorInstance: DirectoryConnector;
let connectionPromise: Promise<DirectoryConnector>;

try {
	directoryConnectorInstance = CreateDirectoryConnector();
	connectionPromise = directoryConnectorInstance.connect();
} catch (err) { // Catch errors in connector creation so that they can be handled by an error boundary
	directoryConnectorInstance = new UnimplementedDirectoryConnector();
	connectionPromise = Promise.reject(err);
}

export const directoryConnectorContext = createContext<DirectoryConnector>(new UnimplementedDirectoryConnector());

const logger = GetLogger('DirectoryConnectorContextProvider');

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
		<directoryConnectorContext.Provider value={ directoryConnectorInstance }>
			{ children }
		</directoryConnectorContext.Provider>
	);
}

export function useDirectoryConnector(): DirectoryConnector {
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
