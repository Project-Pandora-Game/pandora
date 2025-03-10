import { RenderResult, screen } from '@testing-library/react';
import { noop } from 'lodash-es';
import { ComponentType } from 'react';
import { AuthFormData, authFormDataContext } from '../../../src/components/login/authFormDataProvider.tsx';
import { AuthFormRouter } from '../../../src/components/login/authFormRouter.tsx';
import { AccountVerificationForm } from '../../../src/components/login/forms/accountVerificationForm.tsx';
import { ForgotPasswordForm } from '../../../src/components/login/forms/forgotPasswordForm.tsx';
import { LoginForm } from '../../../src/components/login/forms/loginForm.tsx';
import { RegistrationForm } from '../../../src/components/login/forms/registrationForm.tsx';
import { ResendVerificationForm } from '../../../src/components/login/forms/resendVerificationForm.tsx';
import { ResetPasswordForm } from '../../../src/components/login/forms/resetPasswordForm.tsx';
import { authPagePathsAndComponents } from '../../../src/routing/authRoutingData.ts';
import { RenderWithRouterAndProviders } from '../../testUtils.tsx';

const originalCrypto = window.crypto;

Object.defineProperty(window, 'crypto', {
	value: window.crypto,
	enumerable: true,
	configurable: true,
	writable: true,
});

describe('AuthFormRouter', () => {
	it.each(authPagePathsAndComponents)('should render an error message on the path %p if SubtleCrypto is not available', (_path, element) => {
		// @ts-expect-error - Simulating no SubtleCrypto
		// noinspection JSConstantReassignment
		window.crypto = {};
		renderWithComponent(element);
		expect(screen.getByText(/Cryptography service is not available/)).toBeVisible();
		// noinspection JSConstantReassignment
		window.crypto = originalCrypto;
	});

	it.each`
	formName                              | expectedHeading        | component
	${ 'login form' }                     | ${ '' }                | ${ LoginForm }
	${ 'account verification form' }      | ${ 'Club login' }      | ${ AccountVerificationForm }
	${ 'registration form' }              | ${ 'Sign up' }         | ${ RegistrationForm }
	${ 'forgot password form' }           | ${ 'Forgot password' } | ${ ForgotPasswordForm }
	${ 'resend verification email form' } | ${ 'Resend email' }    | ${ ResendVerificationForm }
	${ 'password reset form' }            | ${ 'Reset password' }  | ${ ResetPasswordForm }
	`('should display the $formName',
		({ component, expectedHeading }: { component: ComponentType<Record<string, never>>; expectedHeading: string; }) => {
			renderWithComponent(component);
			if (expectedHeading) {
				const heading = screen.getByRole('heading', { level: 1 });
				expect(heading).toBeVisible();
				expect(heading).toHaveTextContent(expectedHeading);
			}
		},
	);

	function renderWithComponent(component: ComponentType<Record<string, never>>): RenderResult {
		const contextState: AuthFormData = Object.freeze({
			state: { username: 'username', password: 'password' },
			setState: noop,
		});
		return RenderWithRouterAndProviders(
			<authFormDataContext.Provider value={ contextState }>
				<AuthFormRouter component={ component } />
			</authFormDataContext.Provider>,
		);
	}
});
