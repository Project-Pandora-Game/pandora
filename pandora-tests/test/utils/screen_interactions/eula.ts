import { expect } from '@playwright/test';
import { TestStep } from '../utils.ts';
import { TestScreenHandler } from './_base.ts';

export const TEST_EULA_TEXT = 'By playing this game, you agree to the following:';

export class ScreenHandlerEula extends TestScreenHandler {

	@TestStep
	public async agree(): Promise<void> {
		await expect(this.page.getByText(TEST_EULA_TEXT)).toBeVisible();
		await this.page.getByRole('button', { name: /^Agree/ }).click();
		await expect(this.page.getByText(TEST_EULA_TEXT)).not.toBeVisible();
	}
}
