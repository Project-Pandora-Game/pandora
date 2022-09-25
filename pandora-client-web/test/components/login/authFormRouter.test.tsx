import { RenderResult, screen } from '@testing-library/react';
import { noop } from 'lodash';
import React, { ComponentType } from 'react';
import { AuthFormData, authFormDataContext } from '../../../src/components/login/authFormDataProvider';
import { AuthFormRouter } from '../../../src/components/login/authFormRouter';
import { AccountVerificationForm } from '../../../src/components/login/forms/accountVerificationForm';
import { ForgotPasswordForm } from '../../../src/components/login/forms/forgotPasswordForm';
import { LoginForm } from '../../../src/components/login/forms/loginForm';
import { RegistrationForm } from '../../../src/components/login/forms/registrationForm';
import { ResendVerificationForm } from '../../../src/components/login/forms/resendVerificationForm';
import { ResetPasswordForm } from '../../../src/components/login/forms/resetPasswordForm';
import { authPageComponents } from '../../../src/routing/authRoutingData';
import { RenderWithRouterAndProviders } from '../../testUtils';

const originalCrypto = window.crypto;

Object.defineProperty(window, 'crypto', {
	value: window.crypto,
	enumerable: true,
	configurable: true,
	writable: true,
});

describe('AuthFormRouter', () => {
	it.each(authPageComponents)('should render an error message on the path %p if SubtleCrypto is not available', (path) => {
		// @ts-expect-error - Simulating no SubtleCrypto
		// noinspection JSConstantReassignment
		window.crypto = {};
		renderWithComponent(path);
		expect(screen.getByText(/Cryptography service is not available/)).toBeVisible();
		// noinspection JSConstantReassignment
		window.crypto = originalCrypto;
	});

	it.each`
	formName                              | expectedHeading        | component
	${ 'login form' }                     | ${ 'Club login' }      | ${ LoginForm }
	${ 'account verification form' }      | ${ 'Club login' }      | ${ AccountVerificationForm }
	${ 'registration form' }              | ${ 'Sign up' }         | ${ RegistrationForm }
	${ 'forgot password form' }           | ${ 'Forgot password' } | ${ ForgotPasswordForm }
	${ 'resend verification email form' } | ${ 'Resend email' }    | ${ ResendVerificationForm }
	${ 'password reset form' }            | ${ 'Reset password' }  | ${ ResetPasswordForm }
	`('should display the $formName',
		({ component, expectedHeading }: { component: ComponentType<Record<string, never>>, expectedHeading: string }) => {
			renderWithComponent(component);
			const heading = screen.getByRole('heading');
			expect(heading).toBeVisible();
			expect(heading).toHaveTextContent(expectedHeading);
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
