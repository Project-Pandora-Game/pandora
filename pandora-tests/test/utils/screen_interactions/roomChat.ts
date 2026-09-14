import { expect } from '@playwright/test';
import { TestStep } from '../utils.ts';
import { TestScreenHandler } from './_base.ts';

export class ScreenHandlerRoomChat extends TestScreenHandler {
	@TestStep
	public async sendMessage(message: string): Promise<void> {
		await this.page.locator('.chatArea textarea').fill(message);
		await this.page.locator('.chatArea textarea').press('Enter');
	}

	@TestStep
	public async waitForMessage(message: string): Promise<void> {
		await expect(this.page.locator('.chatArea .message', { hasText: message })).toBeVisible();
	}
}
