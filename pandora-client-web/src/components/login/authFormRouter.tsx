import { IsObject } from 'pandora-common';
import React, { ComponentType, ReactElement, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { FormErrorMessage } from '../common/Form/form';
import { AuthFormDataProvider, useAuthFormData } from './authFormDataProvider';
import './authFormRouter.scss';

export interface AuthFormRouterProps {
	component: ComponentType<Record<string, never>>;
}

export function AuthFormRouter({ component }: AuthFormRouterProps): ReactElement {
	return (
		<div className='AuthFormRouter'>
			<AuthFormDataProvider>
				<AuthFormContent component={ component } />
			</AuthFormDataProvider>
		</div>
	);
}

// eslint-disable-next-line @typescript-eslint/naming-convention
function AuthFormContent({ component: Component }: AuthFormRouterProps): ReactElement | null {
	const location = useLocation();
	const locationState = location.state as unknown;
	const redirectPath = IsObject(locationState) && typeof locationState.redirectPath === 'string' ?
		locationState.redirectPath :
		'';
	const redirectState = IsObject(locationState) && locationState.redirectState != null ?
		locationState.redirectState :
		undefined;
	const { setState: setAuthData } = useAuthFormData();

	useEffect(() => {
		if (redirectPath) {
			setAuthData({ redirectPath, redirectState });
		}
	}, [redirectPath, redirectState, setAuthData]);

	if (!globalThis.crypto.subtle) {
		return (
			<FormErrorMessage>
				Cryptography service is not available. Please check your browser is up to date and that you are using
				HTTPS to connect to this site.
			</FormErrorMessage>
		);
	}

	return Component ? <Component /> : null;
}
