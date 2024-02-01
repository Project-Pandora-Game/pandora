import { LogLevel } from 'pandora-common';
import { USER_DEBUG } from './Environment';

/** Log level to use for logging to console, set by combination of build mode and URL arguments */
export let ConfigLogLevel: LogLevel = USER_DEBUG ? LogLevel.VERBOSE : LogLevel.WARNING;

export function LoadSearchArgs(): void {
	const search = new URLSearchParams(window.location.search);

	if (search.has('loglevel')) {
		const logLevel = search.get('loglevel')?.trim() || '';
		switch (logLevel.toLowerCase()) {
			case 'debug':
				ConfigLogLevel = LogLevel.DEBUG;
				break;
			case 'verbose':
				ConfigLogLevel = LogLevel.VERBOSE;
				break;
			case 'info':
				ConfigLogLevel = LogLevel.INFO;
				break;
			case 'alert':
				ConfigLogLevel = LogLevel.ALERT;
				break;
			case 'warning':
				ConfigLogLevel = LogLevel.WARNING;
				break;
			case 'error':
				ConfigLogLevel = LogLevel.ERROR;
				break;
			case 'fatal':
				ConfigLogLevel = LogLevel.FATAL;
				break;
			default: {
				const parsed = parseInt(logLevel);
				// eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
				if (parsed >= LogLevel.FATAL && parsed <= LogLevel.DEBUG)
					ConfigLogLevel = parsed;
				break;
			}
		}
	}
}
