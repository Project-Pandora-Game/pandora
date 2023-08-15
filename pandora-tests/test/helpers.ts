import type { Page } from 'puppeteer';
import { type JestPuppeteerGlobal, TEST_PROJECT_PANDORA_DIR, TEST_CLIENT_DIST_DIR } from './_setup/config';
import { AssertNotNullable } from './utils';

export function TestBrowserGlobals(): JestPuppeteerGlobal {
	return globalThis as unknown as JestPuppeteerGlobal;
}

const handlePageError = (error: Error) => {
	process.emit('uncaughtException', error);
};

async function DoClosePage(page: Page): Promise<void> {
	const { writeCoverate, puppeteerConfig, httpAddress } = TestBrowserGlobals();

	if (puppeteerConfig.exitOnPageError) {
		page.off('pageerror', handlePageError);
	}

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
}

export async function TestOpenPage(options: TestPageOptions = {}): Promise<Page> {
	const { context, puppeteerConfig } = TestBrowserGlobals();

	const page = await context.newPage();
	if (puppeteerConfig.exitOnPageError) {
		page.on('pageerror', handlePageError);
	}

	if (options.keepOpen) {
		openPagesAll.push(page);
	} else {
		openPagesEach.push(page);
	}

	await page.coverage.startJSCoverage({
		resetOnNavigation: false,
		includeRawScriptCoverage: true,
	});

	return page;
}

export async function TestOpenPandora(options: TestPageOptions = {}): Promise<Page> {
	const { httpAddress } = TestBrowserGlobals();

	const page = await TestOpenPage(options);

	await page.goto(httpAddress, {
		waitUntil: 'networkidle2',
	});

	return page;
}
