import type { Page } from '@playwright/test';
import { GetClientHandler, type ClientHandler } from '../_clientHandler.ts';

export class TestScreenHandler {
	public readonly page: Page;

	protected get clientHandler(): ClientHandler {
		return GetClientHandler(this.page);
	}

	constructor(page: Page) {
		this.page = page;
	}
}
