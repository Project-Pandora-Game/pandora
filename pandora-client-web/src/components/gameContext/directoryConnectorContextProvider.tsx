import { noop } from 'lodash';
import { GetLogger, IDirectoryAccountInfo, IDirectoryClientChangeEvents } from 'pandora-common';
import React, { createContext, ReactElement, useContext, useEffect, useRef } from 'react';
import { ChildrenProps } from '../../common/reactTypes';
import { useDebugExpose } from '../../common/useDebugExpose';
import { useErrorHandler } from '../../common/useErrorHandler';
import { DIRECTORY_ADDRESS } from '../../config/Environment';
import { AuthToken, DirectoryConnector } from '../../networking/directoryConnector';
import { SocketIODirectoryConnector } from '../../networking/socketio_directory_connector';
import { UnimplementedDirectoryConnector } from '../../networking/unimplementedDirectoryConnector';
import { useObservable } from '../../observable';

let directoryConnectorInstance: DirectoryConnector;
let connectionPromise: Promise<DirectoryConnector>;

/** Factory function responsible for providing the concrete directory connector implementation to the application */
function CreateDirectoryConnector(): DirectoryConnector {
	if (!DIRECTORY_ADDRESS) {
		throw new Error('Unable to create directory connector: missing DIRECTORY_ADDRESS');
	}

	return SocketIODirectoryConnector.create(DIRECTORY_ADDRESS);
}

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

	useDebugExpose('directoryConnector', directoryConnectorInstance);

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
