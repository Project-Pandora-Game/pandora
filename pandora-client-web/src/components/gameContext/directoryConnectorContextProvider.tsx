import { noop } from 'lodash';
import { ACCOUNT_SETTINGS_DEFAULT, GetLogger, IDirectoryAccountInfo, IDirectoryAccountSettings, IDirectoryClientChangeEvents } from 'pandora-common';
import React, { createContext, ReactElement, useContext, useEffect, useRef } from 'react';
import { ChildrenProps } from '../../common/reactTypes';
import { useDebugExpose } from '../../common/useDebugExpose';
import { useErrorHandler } from '../../common/useErrorHandler';
import { DIRECTORY_ADDRESS } from '../../config/Environment';
import { AuthToken, DirectoryConnector } from '../../networking/directoryConnector';
import { SocketIODirectoryConnector } from '../../networking/socketio_directory_connector';
import { Observable, useNullableObservable, useObservable } from '../../observable';
import { Immutable } from 'immer';
import { ConfigServerIndex } from '../../config/searchArgs';

const DirectoryConnector = new Observable<DirectoryConnector | undefined>(undefined);

let connectionPromise: Promise<DirectoryConnector> | undefined;

/** Factory function responsible for providing the concrete directory connector implementation to the application */
function CreateDirectoryConnector(): DirectoryConnector {
	const directoryAddressOptions = DIRECTORY_ADDRESS.split(';').map((a) => a.trim());
	const directoryAddress = directoryAddressOptions[ConfigServerIndex.value];

	if (!directoryAddress) {
		throw new Error('Unable to create directory connector: missing DIRECTORY_ADDRESS');
	}

	return SocketIODirectoryConnector.create(directoryAddress);
}

export const directoryConnectorContext = createContext<DirectoryConnector | undefined>(undefined);

const logger = GetLogger('DirectoryConnectorContextProvider');

export function DirectoryConnectorContextProvider({ children }: ChildrenProps): ReactElement | null {
	const errorHandler = useErrorHandler();

	useEffect(() => {
		void (async () => {
			try {
				if (DirectoryConnector.value === undefined) {
					DirectoryConnector.value = CreateDirectoryConnector();
				}
				if (connectionPromise === undefined) {
					connectionPromise = DirectoryConnector.value?.connect();
				}
				await connectionPromise;
			} catch (error) {
				logger.fatal('Directory connection failed:', error);
				errorHandler(error);
			}
		})();
	}, [errorHandler]);

	const directoryConnectorInstance = useObservable(DirectoryConnector);

	useDebugExpose('directoryConnector', directoryConnectorInstance);

	if (!directoryConnectorInstance)
		return null;

	return (
		<directoryConnectorContext.Provider value={ directoryConnectorInstance }>
			{ children }
		</directoryConnectorContext.Provider>
	);
}

/**
 * Uses directory connector in an optional way.
 * This should only be used for things that can be accessed from editor - in other cases the connector should exist.
 */
function useDirectoryConnectorOptional(): DirectoryConnector | undefined {
	return useContext(directoryConnectorContext);
}

export function useDirectoryConnector(): DirectoryConnector {
	const connector = useDirectoryConnectorOptional();
	if (connector == null) {
		throw new Error('Attempt to access DirectoryConnector outside of context');
	}
	return connector;
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

export function useCurrentAccountSettings(): Immutable<IDirectoryAccountSettings> {
	// Get account manually to avoid error in the editor
	const account = useNullableObservable(useDirectoryConnectorOptional()?.currentAccount);
	// It is safe to return it simply like this, as when settings change, the whole account object is updated (it is immutable)
	return account?.settings ?? ACCOUNT_SETTINGS_DEFAULT;
}

export function useAuthToken(): AuthToken | undefined {
	const directoryConnector = useDirectoryConnector();
	return useObservable(directoryConnector.authToken);
}

export function useAuthTokenIsValid(): boolean {
	const authToken = useAuthToken();
	const [isValid, setIsValid] = React.useState(authToken != null && authToken.expires >= Date.now());

	React.useEffect(() => {
		const now = Date.now();

		if (authToken == null || authToken.expires <= now) {
			setIsValid(false);
			return;
		}

		setIsValid(true);

		const interval = setTimeout(() => {
			setIsValid(false);
		}, authToken.expires - now);

		return () => {
			clearTimeout(interval);
		};
	}, [authToken]);

	return authToken != null && isValid;
}
