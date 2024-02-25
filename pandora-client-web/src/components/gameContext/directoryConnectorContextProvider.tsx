import { Immutable } from 'immer';
import { noop } from 'lodash';
import {
	ACCOUNT_SETTINGS_DEFAULT,
	AssertNever,
	GetLogger,
	IDirectoryAccountInfo,
	IDirectoryClientChangeEvents,
	SecondFactorData,
	SecondFactorResponse,
	SecondFactorType,
	type AccountSettings,
} from 'pandora-common';
import React, { ReactElement, createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { ChildrenProps } from '../../common/reactTypes';
import { useDebugExpose } from '../../common/useDebugExpose';
import { useErrorHandler } from '../../common/useErrorHandler';
import { DIRECTORY_ADDRESS } from '../../config/Environment';
import { ConfigServerIndex } from '../../config/searchArgs';
import { AuthToken, DirectoryConnector } from '../../networking/directoryConnector';
import { SocketIODirectoryConnector } from '../../networking/socketio_directory_connector';
import { Observable, useNullableObservable, useObservable } from '../../observable';
import { Button } from '../common/button/button';
import { Row } from '../common/container/container';
import { Form, FormFieldCaptcha } from '../common/form/form';
import { ModalDialog } from '../dialog/dialog';

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
			<SecondFactorDialog />
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

/**
 * Gets modified settings for the current account.
 * @returns The partial settings object, or `undefined` if no account is loaded.
 */
export function useModifiedAccountSettings(): Immutable<Partial<AccountSettings>> | undefined {
	// Get account manually to avoid error in the editor
	return useNullableObservable(useDirectoryConnectorOptional()?.currentAccount)?.settings;
}

/**
 * Resolves full account settings to their effective values.
 * @returns The settings that apply to this account.
 */
export function useEffectiveAccountSettings(): Immutable<AccountSettings> {
	const modifiedSettings = useModifiedAccountSettings();
	return useMemo((): Immutable<AccountSettings> => ({
		...modifiedSettings,
		...ACCOUNT_SETTINGS_DEFAULT,
	}), [modifiedSettings]);
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

type SecondFactorState = {
	types: SecondFactorType[];
	invalid: SecondFactorType[] | null;
	resolve: (data: SecondFactorData | PromiseLike<SecondFactorData> | null) => void;
	reject: (reason?: Error) => void;
};

function SecondFactorDialog() {
	const directoryConnector = useDirectoryConnector();
	const [state, setState] = React.useState<SecondFactorState | null>(null);

	const secondFactorHandler = React.useCallback((response: SecondFactorResponse) => {
		return new Promise<SecondFactorData | null>((resolve, reject) => {
			setState({
				types: response.types,
				invalid: response.result === 'secondFactorInvalid' ? response.invalid : null,
				resolve,
				reject,
			});
		}).finally(() => {
			setState(null);
		});
	}, [setState]);

	React.useEffect(() => {
		directoryConnector.secondFactorHandler = secondFactorHandler;
		return () => {
			state?.resolve(null);
			directoryConnector.secondFactorHandler = null;
		};
	}, [directoryConnector, state, secondFactorHandler]);

	if (state == null) {
		return null;
	}

	return <SecondFactorDialogImpl { ...state } />;
}

function SecondFactorDialogImpl({ types, invalid, resolve }: SecondFactorState): ReactElement {
	const [captcha, setCaptcha] = React.useState('');

	const elements = React.useMemo(() => types.map((type) => {
		switch (type) {
			case 'captcha':
				return <FormFieldCaptcha key='captcha' setCaptchaToken={ setCaptcha } invalidCaptcha={ invalid != null && invalid.includes('captcha') } />;
			default:
				AssertNever(type);
		}
	}), [types, invalid, setCaptcha]);

	const onSubmit = React.useCallback(() => {
		const data: SecondFactorData = {};
		if (types.includes('captcha')) {
			data.captcha = captcha;
		}
		resolve(data);
	}, [types, captcha, resolve]);

	const onCancel = React.useCallback(() => {
		resolve(null);
	}, [resolve]);

	return (
		<ModalDialog>
			<Form onSubmit={ onSubmit }>
				<h3>Second factor required</h3>
				{ elements }
				<Row>
					<Button type='submit'>Submit</Button>
					<Button onClick={ onCancel }>Cancel</Button>
				</Row>
			</Form>
		</ModalDialog>
	);
}
