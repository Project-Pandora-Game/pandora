import { noop } from 'lodash-es';
import {
	GetLogger,
	IDirectoryClientChangeEvents,
} from 'pandora-common';
import React, { useEffect, useRef } from 'react';
import { useDebugExpose } from '../../common/useDebugExpose.ts';
import { useErrorHandler } from '../../common/useErrorHandler.ts';
import { DIRECTORY_ADDRESS } from '../../config/Environment.ts';
import { ConfigServerIndex } from '../../config/searchArgs.ts';
import { AuthToken, DirectoryConnectionState, DirectoryConnector } from '../../networking/directoryConnector.ts';
import { SocketIOConnector } from '../../networking/socketio_connector.ts';
import { useNullableObservable } from '../../observable.ts';
import { useService, useServiceOptional } from '../../services/serviceProvider.tsx';

/** Factory function responsible for providing the concrete directory connector implementation to the application */
function GetDirectoryAddress(): string {
	const directoryAddressOptions = DIRECTORY_ADDRESS.split(';').map((a) => a.trim());
	const directoryAddress = directoryAddressOptions[ConfigServerIndex.value];

	if (!directoryAddress) {
		throw new Error('Unable to create directory connector: missing DIRECTORY_ADDRESS');
	}

	return directoryAddress;
}

export function GetDirectoryUrl(): URL {
	const address = GetDirectoryAddress();
	return new URL((address.startsWith('/') ? (window.location.origin + address) : address) + (address.endsWith('/') ? '' : '/'));
}

const logger = GetLogger('DirectoryConnectorServices');

export function DirectoryConnectorServices(): null {
	const errorHandler = useErrorHandler();
	const directoryConnector = useService('directoryConnector');

	useEffect(() => {
		try {
			if (directoryConnector.state.value === DirectoryConnectionState.NONE) {
				directoryConnector.connect(GetDirectoryAddress(), SocketIOConnector);
			}
		} catch (error) {
			logger.fatal('Directory connection failed:', error);
			errorHandler(error);
		}
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
): void {
	const directoryConnector = useDirectoryConnector();
	const callbackRef = useRef<() => void>(noop);

	useEffect(() => {
		callbackRef.current = callback;
	}, [callback, callbackRef]);

	useEffect(() => {
		const cleanup = [
			directoryConnector.on('somethingChanged', (changes) => {
				if (changes.includes(event)) {
					callbackRef.current();
				}
			}),
			directoryConnector.on('connected', () => {
				callbackRef.current();
			}),
		];

		callbackRef.current();
		return () => {
			cleanup.forEach((c) => c());
		};
	}, [directoryConnector, event, callbackRef]);
}

export function useAuthToken(): AuthToken | undefined {
	const directoryConnector = useServiceOptional('directoryConnector');
	return useNullableObservable(directoryConnector?.authToken) ?? undefined;
}

export function useAuthTokenHeader(): string | undefined {
	const token = useAuthToken();
	if (!token)
		return;

	return `Basic ${btoa(btoa(token.username) + ':' + token.value)}`;
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
