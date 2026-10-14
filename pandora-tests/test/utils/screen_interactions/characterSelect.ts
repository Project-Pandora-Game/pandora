import { expect } from '@playwright/test';
import { TestStep } from '../utils.ts';
import { TestScreenHandler } from './_base.ts';

export class ScreenHandlerCharacterSelect extends TestScreenHandler {
	@TestStep
	public async flowCreateCharacter(name: string): Promise<void> {
		// Click "Create new character" button in the character select list
		await this.page.getByRole('button', { name: 'Create new character' }).click();
		await expect(this.page.locator('div.CharacterCreate')).toBeVisible();
		await expect(this.page.locator('#registration-form')).toBeVisible();

		// Fill in character name
		await this.page.getByRole('textbox', { name: 'Name' }).fill(name);

		// Confirm creation
		await this.page.getByRole('button', { name: 'Confirm' }).click();

		// Wait for navigation to personal space
		await this.page.waitForURL('/');
	}
}
