import { screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { RegistrationForm } from '../../../../src/components/login/forms/registrationForm.tsx';
import { ExpectFieldToBeInvalid, TestFieldIsRendered, TestSubmitButtonIsRendered } from '../../../formTestUtils.ts';
import { RenderWithRouterAndProviders } from '../../../testUtils.tsx';
import { INVALID_DISPLAY_NAMES, INVALID_EMAILS, INVALID_USERNAMES } from '../loginTestData.ts';

describe('Registration Form', () => {
	const defaultUsername = 'test-user';
	const defaultDisplayName = 'test-user-display';
	const defaultEmail = 'test-user@domain.com';
	const defaultPassword = 'password123';

	let user: ReturnType<typeof userEvent.setup>;
	let pathname: string;

	beforeEach(() => {
		user = userEvent.setup();
		RenderWithRouterAndProviders(<RegistrationForm />, {
			initialEntries: ['/register'],
			onPathnameUpdate: (newPathname) => {
				pathname = newPathname;
			},
		});
	});

	TestFieldIsRendered('username', 'Username', 'text', 'username');
	TestFieldIsRendered('displayName', 'User display name (shown to others)', 'text', undefined);
	TestFieldIsRendered('email', 'Email', 'email', 'email');
	TestFieldIsRendered('password', 'Password', 'password', 'new-password');
	TestFieldIsRendered('password confirmation', 'Confirm password', 'password', 'new-password');
	TestSubmitButtonIsRendered();

	it('should not permit an empty username to be submitted', async () => {
		// TODO: Expand this to actually check that a WS message hasn't been sent
		expect(screen.queryByText('Username is required')).not.toBeInTheDocument();

		await user.type(screen.getByLabelText('User display name (shown to others)'), defaultDisplayName);
		await user.type(screen.getByLabelText('Email'), defaultEmail);
		await user.type(screen.getByLabelText('Password'), defaultPassword);
		await user.type(screen.getByLabelText('Confirm password'), defaultPassword);
		await user.click(screen.getByRole('button'));

		await ExpectFieldToBeInvalid('Username');
		// Error is caught by native validation, so the message is not displayed
		// await ExpectFieldToBeInvalid('Username', 'Username is required');
	});

	it('should not permit an empty display name to be submitted', async () => {
		// TODO: Expand this to actually check that a WS message hasn't been sent
		expect(screen.queryByText('User display name (shown to others) is required')).not.toBeInTheDocument();

		await user.type(screen.getByLabelText('Username'), defaultUsername);
		await user.type(screen.getByLabelText('Email'), defaultEmail);
		await user.type(screen.getByLabelText('Password'), defaultPassword);
		await user.type(screen.getByLabelText('Confirm password'), defaultPassword);
		await user.click(screen.getByRole('button'));

		await ExpectFieldToBeInvalid('User display name (shown to others)');
		// Error is caught by native validation, so the message is not displayed
		// await ExpectFieldToBeInvalid('Username', 'Username is required');
	});

	it('should not permit an empty email to be submitted', async () => {
		// TODO: Expand this to actually check that a WS message hasn't been sent
		expect(screen.queryByText('Email is required')).not.toBeInTheDocument();

		await user.type(screen.getByLabelText('Username'), defaultUsername);
		await user.type(screen.getByLabelText('User display name (shown to others)'), defaultDisplayName);
		await user.type(screen.getByLabelText('Password'), defaultPassword);
		await user.type(screen.getByLabelText('Confirm password'), defaultPassword);
		await user.click(screen.getByRole('button'));

		await ExpectFieldToBeInvalid('Email');
		// Error is caught by native validation, so the message is not displayed
		// await ExpectFieldToBeInvalid('Email', 'Email is required');
	});

	it('should not permit an empty password to be submitted', async () => {
		// TODO: Expand this to actually check that a WS message hasn't been sent
		expect(screen.queryByText('Password is required')).not.toBeInTheDocument();

		await user.type(screen.getByLabelText('Username'), defaultUsername);
		await user.type(screen.getByLabelText('User display name (shown to others)'), defaultDisplayName);
		await user.type(screen.getByLabelText('Email'), defaultEmail);
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
		await user.type(screen.getByLabelText('User display name (shown to others)'), defaultDisplayName);
		await user.type(screen.getByLabelText('Email'), defaultEmail);
		await user.type(screen.getByLabelText('Password'), defaultPassword);
		await user.click(screen.getByRole('button'));

		await ExpectFieldToBeInvalid('Confirm password');
		// Error is caught by native validation, so the message is not displayed
		// await ExpectFieldToBeInvalid('Confirm password', 'Please confirm your password');
	});

	it.each(INVALID_USERNAMES)('should not permit the invalid username %p to be submitted', async (invalidUsername) => {
		// TODO: Expand this to actually check that a WS message hasn't been sent
		expect(screen.queryByText('Invalid username format')).not.toBeInTheDocument();

		await fillInAndSubmitForm(invalidUsername, defaultDisplayName, defaultEmail, defaultPassword, defaultPassword);

		await ExpectFieldToBeInvalid('Username');
	});

	it.each(INVALID_DISPLAY_NAMES)('should not permit the invalid display name %p to be submitted', async (invalidDisplayName) => {
		// TODO: Expand this to actually check that a WS message hasn't been sent
		expect(screen.queryByText('Invalid display name format')).not.toBeInTheDocument();

		await fillInAndSubmitForm(defaultUsername, invalidDisplayName, defaultEmail, defaultPassword, defaultPassword);

		await ExpectFieldToBeInvalid('User display name (shown to others)');
	});

	it.each(INVALID_EMAILS)('should not permit the invalid email %p to be submitted', async (invalidEmail) => {
		// TODO: Expand this to actually check that a WS message hasn't been sent
		expect(screen.queryByText('Invalid email format')).not.toBeInTheDocument();

		await fillInAndSubmitForm(defaultUsername, defaultDisplayName, invalidEmail, defaultPassword, defaultPassword);

		await ExpectFieldToBeInvalid('Email');
		// Error may be caught by native validation, so the message is not reliably displayed
		// await ExpectFieldToBeInvalid('Email', 'Invalid email format');
	});

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

			await fillInAndSubmitForm(defaultUsername, defaultDisplayName, defaultEmail, defaultPassword, invalidPasswordConfirm);

			await ExpectFieldToBeInvalid('Confirm password', 'Passwords do not match');
		},
	);

	// TODO: Add a test for end-to-end form submission once we have a decent framework for mocking socket stuff

	it('should provide a link to the login form', async () => {
		await verifyPathname('/register');
		const link = screen.getByRole('link', { name: 'Already have an account? Sign in' });
		expect(link).toBeVisible();

		await user.click(link);

		await verifyPathname('/login');
	});

	async function fillInAndSubmitForm(
		username: string,
		displayName: string,
		email: string,
		password: string,
		passwordConfirm: string,
	): Promise<void> {
		await user.type(screen.getByLabelText('Username'), username);
		await user.type(screen.getByLabelText('User display name (shown to others)'), displayName);
		await user.type(screen.getByLabelText('Email'), email);
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
