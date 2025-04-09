import { IS_NODE } from '../utility/misc.ts';
import { LOG_COLORS, LOG_NAMES, LogLevel } from './constants.ts';
import { Logger, type LoggerConfig, type LogOutputDefinition } from './logger.ts';

declare const console: { info: (...args: unknown[]) => void; };

/** Global log configuration */
export const logConfig: LoggerConfig = {
	printTime: true,
	timeLocale: 'en-IE',
	onFatal: [],
	logOutputs: [],
};

const consoleOutput: LogOutputDefinition = {
	logLevel: LogLevel.DEBUG,
	logLevelOverrides: {},
	supportsColor: IS_NODE,
	onMessage: IS_NODE
		? (prefix, message) => console.info(prefix, ...message)
		: (prefix, message, level) => {
			const log = [prefix.replace(LOG_NAMES[level], `%c${LOG_NAMES[level]}%c`), LOG_COLORS[level], '', ...message];
			const c = console as Record<string, unknown>;
			if (level <= LogLevel.ERROR && typeof c.error === 'function') {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-call
				c.error(...log);
			} else if (level <= LogLevel.WARNING && typeof c.warn === 'function') {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-call
				c.warn(...log);
			} else if (level >= LogLevel.DEBUG && typeof c.debug === 'function') {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-call
				c.debug(...log);
			} else {
				console.info(...log);
			}
		},
};
logConfig.logOutputs.push(consoleOutput);

/**
 * Creates console output for log. There is no output to console by default
 * @param logLevel - Lowest loglevel, which should be outputted to console
 * @param logLevelOverrides - Category specific overrides for loglevel
 */
export function SetConsoleOutput(logLevel: LogLevel, logLevelOverrides: Record<string, LogLevel> = {}): void {
	consoleOutput.logLevel = logLevel;
	consoleOutput.logLevelOverrides = logLevelOverrides;
}

/**
 * Creates new logger instance for specific category
 * @param category - The category of logs
 * @param prefix - Prefix for messages, defaults to `[category]`
 * @returns New logger instance with said category
 */
export function GetLogger(category: string, prefix?: string): Logger {
	return new Logger(category, prefix ?? `[${category}]`, logConfig);
}
