import { expect } from '@playwright/test';
import { TestStep } from '../utils.ts';
import { TestScreenHandler } from './_base.ts';

export class ScreenHandlerRoom extends TestScreenHandler {
	@TestStep
	public async waitForPersonalSpace(): Promise<void> {
		// Verify the "Personal space" tab is visible and active
		await expect(this.page.locator('.roomScreen .tab', { hasText: 'Personal space' })).toBeVisible();
	}
}
