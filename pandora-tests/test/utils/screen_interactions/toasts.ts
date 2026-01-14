import { expect } from '@playwright/test';
import { TestStep } from '../utils.ts';
import { TestScreenHandler } from './_base.ts';

export class ScreenHandlerToasts extends TestScreenHandler {

	@TestStep
	public async expectConnectingToDirectory(expected: boolean): Promise<void> {
		const locator = this.page.getByText('Connecting to Directory...');

		if (expected) {
			await expect(locator).toBeVisible();
		} else {
			await expect(locator).toBeHidden();
		}
	}
}
