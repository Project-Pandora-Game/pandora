import type { Page } from '@playwright/test';
import type { ClientHandler } from '../_clientHandler.ts';

export class TestScreenHandler {
	public readonly page: Page;
	protected readonly clientHandler: ClientHandler;

	constructor(page: Page, clientHandler: ClientHandler) {
		this.page = page;
		this.clientHandler = clientHandler;
	}
}
