import { ElementHandle, Page } from 'puppeteer';
import { ClosePage } from './helpers';
import { AssertNotNullable } from './utils';

function TextQueryEscape(text: string): string {
	return text.replace(/(["\\])/, '\\$1');
}

export class PageTester {
	public readonly rawPage: Page;

	constructor(rawPage: Page) {
		this.rawPage = rawPage;
	}

	public async close(): Promise<void> {
		await ClosePage(this.rawPage);
	}

	public async findElement(selector: string): Promise<ElementHandle<Element>> {
		const element = await this.rawPage.waitForSelector(selector, { visible: true });
		AssertNotNullable(element);
		return element;
	}

	public async waitForMissingElement(selector: string): Promise<void> {
		const element = await this.rawPage.waitForSelector(selector, { hidden: true });
		expect(element).toBeNull();
	}

	public async findLink(text: string): Promise<ElementHandle<HTMLAnchorElement>> {
		const element = await this.findElement(`a::-p-text("${TextQueryEscape(text)}")`);
		return element as ElementHandle<HTMLAnchorElement>;
	}

	public async findButton(text: string): Promise<ElementHandle<HTMLAnchorElement>> {
		const element = await this.findElement(`button::-p-text("${TextQueryEscape(text)}")`);
		return element as ElementHandle<HTMLAnchorElement>;
	}

	public async expectNavigation(action: () => void | Promise<void>): Promise<void> {
		const navigationPromise = this.rawPage.waitForNavigation({ waitUntil: 'networkidle2' });
		await action();
		await navigationPromise;
	}
}
