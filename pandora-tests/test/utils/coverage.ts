/* eslint-disable no-console */
import { Page } from '@playwright/test';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import v8ToIstanbul from 'v8-to-istanbul';
import { TEST_CLIENT_DIR, TEST_CLIENT_DIST_DIR, TEST_COVERAGE_TEMP } from '../_setup/config.ts';

type FilterType<T, F> = T extends F ? T : never;

// When library doesn't export the type it expects...
type SourceMapInput = FilterType<
	NonNullable<Parameters<(typeof v8ToIstanbul)>[2]>,
	{ originalSource: string; }
>['sourceMap']['sourcemap'];

type EncodedSourceMap = FilterType<SourceMapInput, { mappings: string; }>;

function GenerateRandomId(): string {
	return crypto.randomBytes(16).toString('hex');
}

export async function CoverageProcessPage(page: Page, baseUrl: string | undefined): Promise<void> {
	const coverageResult = await page.coverage.stopJSCoverage();

	if (baseUrl == null)
		return;

	for (const result of coverageResult) {
		let filePath: string;
		if (result.url.startsWith(baseUrl)) {
			filePath = path.resolve(
				TEST_CLIENT_DIST_DIR,
				result.url
					.slice(baseUrl.length)
					.replace(/^\/?/, './'),
			);
		} else {
			continue;
		}

		if (!fs.existsSync(filePath)) {
			console.warn('Resolved coverage file not found:\n', filePath);
		}

		// Get sourcemap if possible
		const sourcemapPath = `${filePath}.map`;
		let sourcemapContent: EncodedSourceMap | undefined;

		if (fs.existsSync(sourcemapPath)) {
			// @ts-expect-error: It should hopefully be the right type
			sourcemapContent = (JSON.parse(fs.readFileSync(sourcemapPath, 'utf-8')) as unknown);
		}

		// Rewrite sourcemap's original file paths
		if (sourcemapContent != null) {
			sourcemapContent = MapSourcePaths(sourcemapContent);
		}

		// Prepare converter
		const converter = v8ToIstanbul(
			filePath,
			0,
			sourcemapContent ? {
				source: fs.readFileSync(filePath, 'utf-8'),
				originalSource: '',
				sourceMap: {
					sourcemap: sourcemapContent,
				},
			} : {
				source: fs.readFileSync(filePath, 'utf-8'),
			},
			(sourcePath) => {
				// Ignore any webpack runtime code
				if (sourcePath.includes('webpack-internal:'))
					return true;

				// Ignore any libraries (pandora-common is not here)
				if (sourcePath.includes('node_modules'))
					return true;

				// Ignore non-TS/JS files (like images)
				if (!/\.(ts|js)x?$/.test(sourcePath)) {
					return true;
				}

				// Check the file actually exists
				if (!fs.existsSync(sourcePath)) {
					console.warn('Source path target not found:', sourcePath);
				}

				// Ignore .js files (these cause error for some reason, otherwise they should be included)
				if (sourcePath.endsWith('.js'))
					return true;

				return false;
			},
		);
		await converter.load();

		converter.applyCoverage(result.functions);

		const istanbulData = converter.toIstanbul();

		// Save this report with random name
		fs.writeFileSync(
			path.join(
				TEST_COVERAGE_TEMP,
				`client_coverage_${GenerateRandomId()}.json`,
			),
			JSON.stringify(istanbulData),
			{ encoding: 'utf-8' },
		);
	}
}

// Rewriting rules for webpack
const mappings: readonly [string, string][] = [
	['webpack://pandora-client-web/webpack/', 'webpack-internal://'],
	['webpack://pandora-client-web/', TEST_CLIENT_DIR + '/'],
];

function MapSourcePaths(sourcemap: EncodedSourceMap): EncodedSourceMap {
	return {
		...sourcemap,
		sources: sourcemap.sources.map((source) => {
			if (typeof source !== 'string')
				return source;

			for (const [k, v] of mappings) {
				if (source.startsWith(k)) {
					source = v + source.slice(k.length);

					// The resolve *MUST* be done,
					// otherwise remapping fails at a later stage,
					// resulting in all files having 0 functions/statements
					if (fs.existsSync(source)) {
						source = path.resolve(source);
					}
				}
			}

			return source;
		}).filter(Boolean),
	};
}
