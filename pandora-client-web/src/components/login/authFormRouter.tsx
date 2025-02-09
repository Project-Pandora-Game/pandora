import { ComponentType, ReactElement } from 'react';
import { FormErrorMessage } from '../common/form/form';
import './authForm.scss';
import { AuthFormDataProvider } from './authFormDataProvider';

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

function AuthFormContent({ component: Component }: AuthFormRouterProps): ReactElement | null {
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
