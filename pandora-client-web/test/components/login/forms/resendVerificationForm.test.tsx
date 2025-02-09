import { screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { ResendVerificationForm } from '../../../../src/components/login/forms/resendVerificationForm';
import { ExpectFieldToBeInvalid, TestFieldIsRendered, TestSubmitButtonIsRendered } from '../../../formTestUtils';
import { RenderWithRouterAndProviders } from '../../../testUtils';
import { INVALID_EMAILS } from '../loginTestData';

describe('Resend Verification Email Form', () => {
	let user: ReturnType<typeof userEvent.setup>;
	let pathname: string;

	beforeEach(() => {
		user = userEvent.setup();
		RenderWithRouterAndProviders(<ResendVerificationForm />, {
			initialEntries: ['/resend_verification_email'],
			onPathnameUpdate: (newPathname) => {
				pathname = newPathname;
			},
		});
	});

	TestFieldIsRendered('email', 'Enter your email', 'email', 'email');
	TestSubmitButtonIsRendered();

	it('should not permit an empty email to be submitted', async () => {
		// TODO: Expand this to actually check that a WS message hasn't been sent
		expect(screen.queryByText('Invalid email format')).not.toBeInTheDocument();

		await user.click(screen.getByRole('button'));

		await ExpectFieldToBeInvalid('Enter your email');
		// Error is caught by native validation, so the message is not displayed
		// await ExpectFieldToBeInvalid('Enter your email', 'Email is required');
	});

	it.each(INVALID_EMAILS)('should not permit the invalid email %p to be submitted', async (email) => {
		// TODO: Expand this to actually check that a WS message hasn't been sent
		expect(screen.queryByText('Invalid email format')).not.toBeInTheDocument();

		await user.type(screen.getByLabelText('Enter your email'), email);
		await user.click(screen.getByRole('button'));

		await ExpectFieldToBeInvalid('Enter your email');
		// Error may be caught by native validation, so the message is not reliably displayed
		// await ExpectFieldToBeInvalid('Enter your email', 'Invalid email format');
	});

	// TODO: Add a test for end-to-end form submission once we have a decent framework for mocking socket stuff

	it('should provide a link to the password reset form', async () => {
		await verifyPathname('/resend_verification_email');
		const link = screen.getByRole('link', { name: '◄ Return to login' });
		expect(link).toBeVisible();

		await user.click(link);

		await verifyPathname('/login');
	});

	async function verifyPathname(expectedPath: string): Promise<void> {
		await waitFor(() => {
			expect(pathname).toBe(expectedPath);
		});
	}
});
