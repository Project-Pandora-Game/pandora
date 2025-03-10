import { RenderResult, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { ReactElement } from 'react';
import { authFormDataContext, AuthFormDataState } from '../../../../src/components/login/authFormDataProvider.tsx';
import { AccountVerificationForm } from '../../../../src/components/login/forms/accountVerificationForm.tsx';
import { ExpectFieldToBeInvalid, TestFieldIsRendered, TestSubmitButtonIsRendered } from '../../../formTestUtils.ts';
import { RenderWithRouterAndProviders } from '../../../testUtils.tsx';
import { INVALID_FORMAT_TOKENS, INVALID_LENGTH_TOKENS } from '../loginTestData.ts';
const jest = import.meta.jest; // Jest is not properly injected in ESM

describe('Account Verification Form', () => {
	const username = 'test-user';
	const password = 'password';

	let user: ReturnType<typeof userEvent.setup>;
	let pathname: string;

	beforeEach(() => {
		user = userEvent.setup();
	});

	describe('Invalid contextual auth data', () => {
		it('should redirect to the login page if no auth data context is present', async () => {
			renderForm(<AccountVerificationForm />);
			await verifyPathname('/login');
		});

		it('should redirect to the login page if no username is present on the auth data context', async () => {
			renderWithContext({ password });
			await verifyPathname('/login');
		});

		it('should redirect to the login page if no password is present on the auth data context', async () => {
			renderWithContext({ username });
			await verifyPathname('/login');
		});
	});

	describe('Valid contextual auth data', () => {
		beforeEach(() => {
			renderWithContext();
		});

		TestFieldIsRendered('verification code', 'Verification code', 'text', 'one-time-code');
		TestSubmitButtonIsRendered();

		it('should not permit an empty verification token to be submitted', async () => {
			// TODO: Expand this to actually check that a WS message hasn't been sent
			expect(screen.queryByText('Verification code is required')).not.toBeInTheDocument();

			await user.click(screen.getByRole('button'));

			await ExpectFieldToBeInvalid('Verification code');
			// Error is caught by native validation, so the message is not displayed
			// await ExpectFieldToBeInvalid('Verification code', 'Verification code is required');
		});

		it.each(INVALID_LENGTH_TOKENS)('should not permit the invalid token %p to be submitted', async (token) => {
			// TODO: Expand this to actually check that a WS message hasn't been sent
			expect(screen.queryByText('Verification code is required')).not.toBeInTheDocument();

			await user.type(screen.getByLabelText('Verification code'), token);
			await user.click(screen.getByRole('button'));

			await ExpectFieldToBeInvalid('Verification code', 'Verification code must be exactly 6 characters');
		});

		it('should prevent a token longer than 6 characters from being entered', async () => {
			await user.type(screen.getByLabelText('Verification code'), '1234567890');
			expect(screen.getByLabelText('Verification code')).toHaveValue('123456');
		});

		it.each(INVALID_FORMAT_TOKENS)('should not permit the invalid token %p to be submitted', async (token) => {
			// TODO: Expand this to actually check that a WS message hasn't been sent
			expect(screen.queryByText('Verification code is required')).not.toBeInTheDocument();

			await user.type(screen.getByLabelText('Verification code'), token);
			await user.click(screen.getByRole('button'));

			await ExpectFieldToBeInvalid('Verification code', 'Invalid verification code format');
		});

		// TODO: Add a test for end-to-end form submission once we have a decent framework for mocking socket stuff

		it('should provide a link to the resend verification email form', async () => {
			await verifyPathname('/login_verify');
			const link = screen.getByRole('link', { name: 'Didn\'t receive a code by email?' });
			expect(link).toBeVisible();

			await user.click(link);

			await verifyPathname('/resend_verification_email');
		});
	});

	async function verifyPathname(expectedPath: string): Promise<void> {
		await waitFor(() => {
			expect(pathname).toBe(expectedPath);
		});
	}

	function renderForm(element: ReactElement): RenderResult {
		return RenderWithRouterAndProviders(element, {
			initialEntries: ['/login_verify'],
			onPathnameUpdate: (newPathname) => {
				pathname = newPathname;
			},
		});
	}

	function renderWithContext(state: AuthFormDataState = { username, password }): RenderResult {
		const contextValue = Object.freeze({ state: { ...state }, setState: jest.fn() });
		return renderForm(
			<authFormDataContext.Provider value={ contextValue }>
				<AccountVerificationForm />
			</authFormDataContext.Provider>,
		);
	}
});
