import { GetLogger, LogLevel } from 'pandora-common';
import * as z from 'zod';
import { BrowserStorage } from '../browserStorage.ts';
import { Observable } from '../observable.ts';
import { USER_DEBUG } from './Environment.ts';

/** Log level to use for logging to console, set by combination of build mode and URL arguments */
export const ConfigLogLevel: Observable<LogLevel> = BrowserStorage.createSession(
	'config-loglevel',
	USER_DEBUG ? LogLevel.VERBOSE : LogLevel.WARNING,
	z.enum(LogLevel),
);

/** Server index to use, set by URL arguments */
export const ConfigServerIndex: Observable<number> = BrowserStorage.createSession(
	'config-serverindex',
	0,
	z.number().int().nonnegative(),
);

export const ConfigShowGitHubIntegration: Observable<boolean> = BrowserStorage.createSession(
	'config-show-github-integration',
	false,
	z.boolean(),
);

const logger = GetLogger('SearchArgs');

export function LoadSearchArgs(): void {
	const search = new URLSearchParams(window.location.search);

	if (search.has('loglevel')) {
		const logLevel = search.get('loglevel')?.trim() || '';
		switch (logLevel.toLowerCase()) {
			case 'debug':
				ConfigLogLevel.value = LogLevel.DEBUG;
				break;
			case 'verbose':
				ConfigLogLevel.value = LogLevel.VERBOSE;
				break;
			case 'info':
				ConfigLogLevel.value = LogLevel.INFO;
				break;
			case 'alert':
				ConfigLogLevel.value = LogLevel.ALERT;
				break;
			case 'warning':
				ConfigLogLevel.value = LogLevel.WARNING;
				break;
			case 'error':
				ConfigLogLevel.value = LogLevel.ERROR;
				break;
			case 'fatal':
				ConfigLogLevel.value = LogLevel.FATAL;
				break;
			default: {
				const parsed = parseInt(logLevel);
				// eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
				if (parsed >= LogLevel.FATAL && parsed <= LogLevel.DEBUG) {
					ConfigLogLevel.value = parsed;
				} else {
					logger.warning('Log level has invalid value', logLevel);
				}
				break;
			}
		}
	}

	if (search.has('serverindex')) {
		const serverIndex = search.get('serverindex')?.trim() || '';
		if (/^[0-9]+$/.test(serverIndex)) {
			ConfigServerIndex.value = parseInt(serverIndex, 10);
		} else {
			logger.warning('Server index has invalid value', serverIndex);
		}
	}

	if (search.has('show-github-integration')) {
		const showGitHubIntegration = search.get('show-github-integration')?.trim() || '';
		ConfigShowGitHubIntegration.value = showGitHubIntegration === 'true';
	}
}
