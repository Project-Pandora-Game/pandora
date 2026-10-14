import { expect } from '@playwright/test';
import { TestStep } from '../utils.ts';
import { TestScreenHandler } from './_base.ts';

export class ScreenHandlerTutorial extends TestScreenHandler {
	@TestStep
	public async flowDismissTutorial(): Promise<void> {
		// Wait for tutorial modal to appear
		await expect(this.page.locator('.tutorialDialogContainer')).toBeVisible();
		await this.page.locator('.tutorialDialogContainer .dialog-close').click();
		// Close button triggers a confirmation dialog
		await expect(this.page.locator('.dialog-confirm')).toBeVisible();
		await this.page.getByRole('button', { name: 'Ok', exact: true }).click();

		// Verify tutorial is dismissed
		await expect(this.page.locator('.tutorialDialogContainer')).not.toBeVisible();
	}
}
