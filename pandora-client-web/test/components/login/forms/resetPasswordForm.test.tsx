import { screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { ResetPasswordForm } from '../../../../src/components/login/forms/resetPasswordForm.tsx';
import { ExpectFieldToBeInvalid, TestFieldIsRendered, TestSubmitButtonIsRendered } from '../../../formTestUtils.ts';
import { RenderWithRouterAndProviders } from '../../../testUtils.tsx';
import { INVALID_FORMAT_TOKENS, INVALID_LENGTH_TOKENS, INVALID_USERNAMES } from '../loginTestData.ts';

describe('Reset Password Form', () => {
	const defaultUsername = 'test-user';
	const defaultResetCode = '123456';
	const defaultPassword = 'password123';

	let user: ReturnType<typeof userEvent.setup>;
	let pathname: string;

	beforeEach(() => {
		user = userEvent.setup();
		RenderWithRouterAndProviders(<ResetPasswordForm />, {
			initialEntries: ['/reset_password'],
			onPathnameUpdate: (newPathname) => {
				pathname = newPathname;
			},
		});
	});

	TestFieldIsRendered('username', 'Username', 'text', 'username');
	TestFieldIsRendered('reset code', 'Reset code', 'text', 'one-time-code');
	TestFieldIsRendered('password', 'Password', 'password', 'new-password');
	TestFieldIsRendered('password confirmation', 'Confirm password', 'password', 'new-password');
	TestSubmitButtonIsRendered();

	it('should not permit an empty username to be submitted', async () => {
		// TODO: Expand this to actually check that a WS message hasn't been sent
		expect(screen.queryByText('Username is required')).not.toBeInTheDocument();

		await user.type(screen.getByLabelText('Reset code'), defaultResetCode);
		await user.type(screen.getByLabelText('Password'), defaultPassword);
		await user.type(screen.getByLabelText('Confirm password'), defaultPassword);
		await user.click(screen.getByRole('button'));

		await ExpectFieldToBeInvalid('Username');
		// Error is caught by native validation, so the message is not displayed
		// await ExpectFieldToBeInvalid('Username', 'Username is required');
	});

	it('should not permit an empty reset code to be submitted', async () => {
		// TODO: Expand this to actually check that a WS message hasn't been sent
		expect(screen.queryByText('Reset code is required')).not.toBeInTheDocument();

		await user.type(screen.getByLabelText('Username'), defaultUsername);
		await user.type(screen.getByLabelText('Password'), defaultPassword);
		await user.type(screen.getByLabelText('Confirm password'), defaultPassword);
		await user.click(screen.getByRole('button'));

		await ExpectFieldToBeInvalid('Reset code');
		// Error is caught by native validation, so the message is not displayed
		// await ExpectFieldToBeInvalid('Reset code', 'Reset code is required');
	});

	it('should not permit an empty password to be submitted', async () => {
		// TODO: Expand this to actually check that a WS message hasn't been sent
		expect(screen.queryByText('Password is required')).not.toBeInTheDocument();

		await user.type(screen.getByLabelText('Username'), defaultUsername);
		await user.type(screen.getByLabelText('Reset code'), defaultResetCode);
		await user.type(screen.getByLabelText('Confirm password'), defaultPassword);
		await user.click(screen.getByRole('button'));

		await ExpectFieldToBeInvalid('Password');
		// Error is caught by native validation, so the message is not displayed
		// await ExpectFieldToBeInvalid('Password', 'Password is required');
	});

	it('should not permit an empty confirmation password to be submitted', async () => {
		// TODO: Expand this to actually check that a WS message hasn't been sent
		expect(screen.queryByText('Please confirm your password')).not.toBeInTheDocument();

		await user.type(screen.getByLabelText('Username'), defaultUsername);
		await user.type(screen.getByLabelText('Reset code'), defaultResetCode);
		await user.type(screen.getByLabelText('Password'), defaultPassword);
		await user.click(screen.getByRole('button'));

		await ExpectFieldToBeInvalid('Confirm password');
		// Error is caught by native validation, so the message is not displayed
		// await ExpectFieldToBeInvalid('Confirm password', 'Please confirm your password');
	});

	it.each(INVALID_USERNAMES)('should not permit the invalid username %p to be submitted', async (invalidUsername) => {
		// TODO: Expand this to actually check that a WS message hasn't been sent
		expect(screen.queryByText('Invalid username format')).not.toBeInTheDocument();

		await fillInAndSubmitForm(invalidUsername, defaultResetCode, defaultPassword, defaultPassword);

		await ExpectFieldToBeInvalid('Username');
	});

	it.each(INVALID_LENGTH_TOKENS)(
		'should not permit the invalid reset code %p to be submitted',
		async (invalidResetCode) => {
			// TODO: Expand this to actually check that a WS message hasn't been sent
			expect(screen.queryByText('Reset code is required')).not.toBeInTheDocument();

			await user.type(screen.getByLabelText('Username'), defaultUsername);
			await user.type(screen.getByLabelText('Password'), defaultPassword);
			await user.type(screen.getByLabelText('Confirm password'), defaultPassword);
			await user.type(screen.getByLabelText('Reset code'), invalidResetCode);
			await user.click(screen.getByRole('button'));

			await ExpectFieldToBeInvalid('Reset code', 'Reset code must be exactly 6 characters');
		},
	);

	it('should prevent a reset code longer than 6 characters from being entered', async () => {
		await user.type(screen.getByLabelText('Reset code'), '1234567890');
		expect(screen.getByLabelText('Reset code')).toHaveValue('123456');
	});

	it.each(INVALID_FORMAT_TOKENS)(
		'should not permit the invalid reset code %p to be submitted',
		async (invalidResetCode) => {
			// TODO: Expand this to actually check that a WS message hasn't been sent
			expect(screen.queryByText('Reset code is required')).not.toBeInTheDocument();

			await user.type(screen.getByLabelText('Username'), defaultUsername);
			await user.type(screen.getByLabelText('Password'), defaultPassword);
			await user.type(screen.getByLabelText('Confirm password'), defaultPassword);
			await user.type(screen.getByLabelText('Reset code'), invalidResetCode);
			await user.click(screen.getByRole('button'));

			await ExpectFieldToBeInvalid('Reset code', 'Invalid reset code format');
		},
	);

	it.each([
		'notTheSamePassword',
		`${ defaultPassword }1`,
		defaultPassword.slice(0, -1),
		defaultPassword.slice(1),
	])(
		'should not permit the non-matching password confirmation %p to be submitted',
		async (invalidPasswordConfirm) => {
			// TODO: Expand this to actually check that a WS message hasn't been sent
			expect(screen.queryByText('Passwords do not match')).not.toBeInTheDocument();

			await fillInAndSubmitForm(defaultUsername, defaultResetCode, defaultPassword, invalidPasswordConfirm);

			await ExpectFieldToBeInvalid('Confirm password', 'Passwords do not match');
		},
	);

	// TODO: Add a test for end-to-end form submission once we have a decent framework for mocking socket stuff

	it('should provide a link to the login form', async () => {
		await verifyPathname('/reset_password');
		const link = screen.getByRole('link', { name: '◄ Return to login' });
		expect(link).toBeVisible();

		await user.click(link);

		await verifyPathname('/login');
	});

	async function fillInAndSubmitForm(
		username: string,
		resetCode: string,
		password: string,
		passwordConfirm: string,
	): Promise<void> {
		await user.type(screen.getByLabelText('Username'), username);
		await user.type(screen.getByLabelText('Reset code'), resetCode);
		await user.type(screen.getByLabelText('Password'), password);
		await user.type(screen.getByLabelText('Confirm password'), passwordConfirm);
		await user.click(screen.getByRole('button'));
	}

	async function verifyPathname(expectedPath: string): Promise<void> {
		await waitFor(() => {
			expect(pathname).toBe(expectedPath);
		});
	}
});
