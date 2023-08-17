import type { ConsoleMessage, Page } from 'puppeteer';
import { type JestPuppeteerGlobal, TEST_PROJECT_PANDORA_DIR, TEST_CLIENT_DIST_DIR } from '../_setup/config';
import { AssertNotNullable } from './utils';
import { PageTester } from './pageTester';

export function TestBrowserGlobals(): JestPuppeteerGlobal {
	return globalThis as unknown as JestPuppeteerGlobal;
}

const handleLog = (message: ConsoleMessage) => {
	if (message.type() === 'error') {
		// eslint-disable-next-line no-console
		console.error(
			'Page emitted error log:\n',
			message.text(),
			'\n',
			message.stackTrace().map((entry) => `${entry.url}:${entry.lineNumber}:${entry.columnNumber}`).join('\n'),
		);
		throw new Error('Page emitted error log');
	}
};

const handlePageError = (error: Error) => {
	throw error;
};

async function DoClosePage(page: Page): Promise<void> {
	const { writeCoverate, puppeteerConfig, httpAddress } = TestBrowserGlobals();

	page.off('pageerror', handlePageError);
	page.off('console', handleLog);

	const jsCoverage = await page.coverage.stopJSCoverage();

	// Point to original .js files
	const coverage = jsCoverage
		.map(({ rawScriptCoverage: it }) => {
			AssertNotNullable(it);
			return ({
				...it,
				scriptId: String(it.scriptId),
				url: it.url
					.replaceAll(httpAddress, TEST_CLIENT_DIST_DIR),
			});
		})
		.filter((res) =>
			res.url.startsWith(TEST_PROJECT_PANDORA_DIR) &&
			!res.url.includes('node_modules') &&
			res.url.endsWith('.js') &&
			!res.url.endsWith('.min.js'),
		);

	// Export coverage data
	writeCoverate(coverage);

	await page.close({
		runBeforeUnload: Boolean(puppeteerConfig.runBeforeUnloadOnClose),
	});
}

export async function ClosePage(page: Page): Promise<void> {
	const openEachIndex = openPagesEach.indexOf(page);
	if (openEachIndex >= 0) {
		openPagesEach.splice(openEachIndex, 1);
	}
	const openAllIndex = openPagesAll.indexOf(page);
	if (openAllIndex >= 0) {
		openPagesAll.splice(openAllIndex, 1);
	}

	await DoClosePage(page);
}

let openPagesEach: Page[] = [];
afterEach(async () => {
	await Promise.all(openPagesEach.map(DoClosePage));
	openPagesEach = [];
}, 60_000);

let openPagesAll: Page[] = [];
afterAll(async () => {
	await Promise.all(openPagesAll.map(DoClosePage));
	openPagesAll = [];
}, 60_000);

export interface TestPageOptions {
	keepOpen?: boolean;
	defaultTimeout?: number;
}

export async function TestOpenPage(options: TestPageOptions = {}): Promise<PageTester> {
	const { context } = TestBrowserGlobals();

	const page = await context.newPage();
	page.on('pageerror', handlePageError);
	page.on('console', handleLog);

	if (options.keepOpen) {
		openPagesAll.push(page);
	} else {
		openPagesEach.push(page);
	}

	await page.coverage.startJSCoverage({
		resetOnNavigation: false,
		includeRawScriptCoverage: true,
	});

	page.setDefaultTimeout(options.defaultTimeout ?? 10_000);

	return new PageTester(page);
}

export async function TestOpenPandora(path: `/${string}` = '/', options: TestPageOptions = {}): Promise<PageTester> {
	const { httpAddress } = TestBrowserGlobals();

	const page = await TestOpenPage(options);

	await page.rawPage.goto(httpAddress + path.substring(1), {
		waitUntil: 'networkidle2',
	});

	return page;
}
