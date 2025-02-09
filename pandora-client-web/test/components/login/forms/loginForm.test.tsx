import { screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { LoginForm } from '../../../../src/components/login/forms/loginForm';
import { ExpectFieldToBeInvalid, TestFieldIsRendered, TestSubmitButtonIsRendered } from '../../../formTestUtils';
import { RenderWithRouterAndProviders } from '../../../testUtils';
import { INVALID_USERNAMES } from '../loginTestData';

describe('Login Form', () => {
	let user: ReturnType<typeof userEvent.setup>;

	beforeEach(() => {
		user = userEvent.setup();
	});

	describe('No location state', () => {
		let pathname: string;

		beforeEach(() => {
			RenderWithRouterAndProviders(<LoginForm />, {
				initialEntries: ['/login'],
				onPathnameUpdate: (newPathname) => {
					pathname = newPathname;
				},
			});
		});

		TestFieldIsRendered('username', 'Username', 'text', 'username');
		TestFieldIsRendered('password', 'Password', 'password', 'current-password');
		TestSubmitButtonIsRendered();

		it('should not permit an empty username to be submitted', async () => {
			// TODO: Expand this to actually check that a WS message hasn't been sent
			expect(screen.queryByText('Username is required')).not.toBeInTheDocument();

			await user.type(screen.getByLabelText('Password'), 'password');
			await user.click(screen.getByRole('button'));

			await ExpectFieldToBeInvalid('Username');
			// Error is caught by native validation, so the message is not displayed
			// await ExpectFieldToBeInvalid('Username', 'Username is required');
		});

		it.each(INVALID_USERNAMES)('should not permit the invalid username %p to be submitted', async (username) => {
			// TODO: Expand this to actually check that a WS message hasn't been sent
			expect(screen.queryByText('Invalid username format')).not.toBeInTheDocument();

			await user.type(screen.getByLabelText('Username'), username);
			await user.type(screen.getByLabelText('Password'), 'password');
			await user.click(screen.getByRole('button'));

			await ExpectFieldToBeInvalid('Username');
		});

		it('should not permit an empty password to be submitted', async () => {
			// TODO: Expand this to actually check that a WS message hasn't been sent
			expect(screen.queryByText('Password is required')).not.toBeInTheDocument();

			await user.type(screen.getByLabelText('Username'), 'test-user');
			await user.click(screen.getByRole('button'));

			await ExpectFieldToBeInvalid('Password');
			// Error is caught by native validation, so the message is not displayed
			// await ExpectFieldToBeInvalid('Password', 'Password is required');
		});

		// TODO: Add a test for end-to-end form submission once we have a decent framework for mocking socket stuff

		it('should provide a link to the forgot password form', async () => {
			await verifyPathname('/login');
			const link = screen.getByRole('link', { name: 'Forgot your password?' });
			expect(link).toBeVisible();

			await user.click(link);

			await verifyPathname('/forgot_password');
		});

		it('should provide a link to the account registration form', async () => {
			await verifyPathname('/login');
			const link = screen.getByRole('link', { name: 'Not a member? Sign up' });
			expect(link).toBeVisible();

			await user.click(link);

			await verifyPathname('/register');
		});

		async function verifyPathname(expectedPath: string): Promise<void> {
			await waitFor(() => {
				expect(pathname).toBe(expectedPath);
			});
		}
	});

	it('should display any message that has been pushed to the current history state', async () => {
		const message = 'This is a history message';

		RenderWithRouterAndProviders(<LoginForm />, { initialEntries: [{ pathname: '/login', state: { message } }] });

		await waitFor(() => {
			expect(screen.getByText(message)).toBeVisible();
		});
	});
});
