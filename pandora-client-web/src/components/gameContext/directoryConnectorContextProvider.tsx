import { noop } from 'lodash';
import {
	GetLogger,
	IDirectoryClientChangeEvents,
} from 'pandora-common';
import React, { useEffect, useRef } from 'react';
import { useDebugExpose } from '../../common/useDebugExpose';
import { useErrorHandler } from '../../common/useErrorHandler';
import { DIRECTORY_ADDRESS } from '../../config/Environment';
import { ConfigServerIndex } from '../../config/searchArgs';
import { AuthToken, DirectoryConnector } from '../../networking/directoryConnector';
import { SocketIOConnector } from '../../networking/socketio_connector';
import { useObservable } from '../../observable';
import { useService } from '../../services/serviceProvider';

let connectionPromise: Promise<DirectoryConnector> | undefined;

/** Factory function responsible for providing the concrete directory connector implementation to the application */
function GetDirectoryAddress(): string {
	const directoryAddressOptions = DIRECTORY_ADDRESS.split(';').map((a) => a.trim());
	const directoryAddress = directoryAddressOptions[ConfigServerIndex.value];

	if (!directoryAddress) {
		throw new Error('Unable to create directory connector: missing DIRECTORY_ADDRESS');
	}

	return directoryAddress;
}

const logger = GetLogger('DirectoryConnectorServices');

export function DirectoryConnectorServices(): null {
	const errorHandler = useErrorHandler();
	const directoryConnector = useService('directoryConnector');

	useEffect(() => {
		void (async () => {
			try {
				if (connectionPromise === undefined) {
					connectionPromise = directoryConnector.connect(GetDirectoryAddress(), SocketIOConnector);
				}
				await connectionPromise;
			} catch (error) {
				logger.fatal('Directory connection failed:', error);
				errorHandler(error);
			}
		})();
	}, [errorHandler, directoryConnector]);

	useDebugExpose('directoryConnector', directoryConnector);

	return null;
}

export function useDirectoryConnector(): DirectoryConnector {
	return useService('directoryConnector');
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
		return directoryConnector.on('somethingChanged', (changes) => {
			if (changes.includes(event)) {
				callbackRef.current();
			}
		});
	}, [directoryConnector, event, callbackRef, runImmediate]);
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
