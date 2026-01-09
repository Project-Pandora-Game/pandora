import { expect } from '@playwright/test';
import { TestStep } from '../utils.ts';
import { GetTestWebListener } from '../webListener.ts';
import { TestScreenHandler } from './_base.ts';

export type RegistrationData = {
	username: string;
	displayName: string;
	email: string;
	password: string;
	betaKey?: string;
};

export class ScreenHandlerAuth extends TestScreenHandler {
	@TestStep
	public async flowRegisterActiveLogin(data: RegistrationData): Promise<void> {
		await this.clientHandler.toasts.expectConnectingToDirectory(false);

		await this.loginSignUp();

		const emailExp = GetTestWebListener().emailServer.expectRegistrationEmail(data.email);

		await this.registrationRegister(data);

		const email = await emailExp;
		expect(email.username).toBe(data.username);
		expect(email.code).toBeTruthy();

		await this.verificationEnterCode(email.code);
	}

	@TestStep
	public async loginSignUp(): Promise<void> {
		await this.page.getByRole('link', { name: 'Not a member? Sign up', exact: true }).click();
	}

	@TestStep
	public async registrationRegister({ username, displayName, email, password, betaKey }: RegistrationData): Promise<void> {
		await this.page.getByRole('textbox', { name: 'Username', exact: true }).fill(username);
		await this.page.getByRole('textbox', { name: 'User display name' }).fill(displayName);
		await this.page.getByRole('textbox', { name: 'Email', exact: true }).fill(email);
		await this.page.getByRole('textbox', { name: 'Password', exact: true }).fill(password);
		await this.page.getByRole('textbox', { name: 'Confirm password', exact: true }).fill(password);
		if (betaKey !== undefined) {
			await this.page.getByRole('textbox', { name: 'Beta key', exact: true }).fill(betaKey);
		}

		await this.page.getByRole('button', { name: 'Register', exact: true }).click();

		await expect(this.page.getByText('Account successfully created. Please check your email for your verification code.')).toBeVisible();
	}

	@TestStep
	public async verificationEnterCode(code: string): Promise<void> {
		await this.page.getByRole('textbox', { name: 'Verification code', exact: true }).fill(code);

		await this.page.getByRole('button', { name: 'Sign in', exact: true }).click();
	}
}
