import { IS_NODE } from './utility/misc.ts';

declare const console: { info: (...args: unknown[]) => void; };

/** Loglevel for log messages to determinate severity */
export enum LogLevel {
	/**
	 * Message notifying about error which can't be recovered from.
	 * Any fatal message will trigger `onFatal` handlers, stopping the application
	 */
	FATAL = -1,
	ERROR = 0,
	WARNING = 1,
	ALERT = 2,
	INFO = 3,
	VERBOSE = 4,
	DEBUG = 5,
}

/** Colors used for coloring loglevel names when outputting to console */
const LOG_COLORS: Readonly<Record<LogLevel, string>> = {
	[LogLevel.FATAL]: IS_NODE ? '41m\x1b[97' : 'background-color: red; color: white;',
	[LogLevel.ERROR]: IS_NODE ? '101m\x1b[30' : 'background-color: red; color: black;',
	[LogLevel.WARNING]: IS_NODE ? '43m\x1b[30' : 'background-color: yellow; color: black;',
	[LogLevel.ALERT]: IS_NODE ? '93' : 'background-color: #222; color: yellow;',
	[LogLevel.INFO]: IS_NODE ? '37' : 'background-color: #222; color: white;',
	[LogLevel.VERBOSE]: IS_NODE ? '32' : 'background-color: #222; color: green;',
	[LogLevel.DEBUG]: IS_NODE ? '34' : 'background-color: #222; color: blue;',
};

/** Visible names for each loglevel */
const LOG_NAMES: Readonly<Record<LogLevel, string>> = {
	[LogLevel.FATAL]: ' FATAL ',
	[LogLevel.ERROR]: ' ERROR ',
	[LogLevel.WARNING]: 'WARNING',
	[LogLevel.ALERT]: 'ALERT  ',
	[LogLevel.INFO]: 'INFO   ',
	[LogLevel.VERBOSE]: 'VERB   ',
	[LogLevel.DEBUG]: 'DEBUG  ',
};

/** Definition for any log output */
export interface LogOutputDefinition {
	logLevel: LogLevel | false;
	logLevelOverrides: Record<string, LogLevel | false>;
	supportsColor: boolean;
	onMessage: (prefix: string, message: unknown[], level: LogLevel) => void;
	flush?: () => Promise<void>;
}

/** Global log configuration */
export const logConfig: {
	/** Controls if log messages should contain file timestamp */
	printTime: boolean;
	/** Sets which locale should be used for time, if it is being displayed */
	timeLocale: string;
	/** Handlers for when fatal error occurs */
	onFatal: (() => void)[];
	/** List of places log outputs to */
	logOutputs: LogOutputDefinition[];
} = {
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
	return new Logger(category, prefix ?? `[${category}]`);
}

/**
 * Class for logging messages, *immutable*
 */
export class Logger {
	/** Category of this logger instance, used for determining if message should be logged by loglevel */
	public readonly category: string;
	/** Prefix */
	public readonly prefix: string;

	constructor(category: string, prefix: string) {
		this.category = category;
		this.prefix = prefix;
	}

	// Shortcuts for logging a level

	/** Logs a message with `DEBUG` loglevel */
	public debug(...message: unknown[]): void {
		this.logMessage(LogLevel.DEBUG, message);
	}

	/** Logs a message with `VERBOSE` loglevel. */
	public verbose(...message: unknown[]): void {
		this.logMessage(LogLevel.VERBOSE, message);
	}

	/** Logs a message with `INFO` loglevel. */
	public info(...message: unknown[]): void {
		this.logMessage(LogLevel.INFO, message);
	}

	/** Logs a message with `INFO` loglevel; alias to `.info` to be consistent with JS `console`. */
	public log(...message: unknown[]): void {
		this.logMessage(LogLevel.INFO, message);
	}

	/** Logs a message with `ALERT` loglevel. */
	public alert(...message: unknown[]): void {
		this.logMessage(LogLevel.ALERT, message);
	}

	/** Logs a message with `WARNING` loglevel. */
	public warning(...message: unknown[]): void {
		this.logMessage(LogLevel.WARNING, message);
	}

	/** Logs a message with `ERROR` loglevel. */
	public error(...message: unknown[]): void {
		this.logMessage(LogLevel.ERROR, message);
	}

	/**
	 * Logs a message with `FATAL` loglevel.
	 * Fatal messages notify about error which can't be recovered from.
	 *
	 * Any fatal message will trigger `onFatal` handlers, stopping the application
	 */
	public fatal(...message: unknown[]): void {
		this.logMessage(LogLevel.FATAL, message);
	}

	/**
	 * Logs the message to all outputs that expect this level of message, depending on category
	 * @param level - The loglevel of the message being logged
	 * @param message - The message to log
	 */
	public logMessage(level: LogLevel, message: unknown[]): void {
		const plainPrefix = this.logHeader(level, false);
		const colorPrefix = this.logHeader(level, true);
		for (const output of logConfig.logOutputs) {
			const outputLevel = output.logLevelOverrides[this.category] ?? output.logLevel;
			if (outputLevel !== false && outputLevel >= level) {
				output.onMessage(output.supportsColor ? colorPrefix : plainPrefix, message, level);
			}
		}
		// Fatal messages trigger event
		if (level === LogLevel.FATAL) {
			const handlers = logConfig.onFatal;
			// Clear onFatal handlers, so each fatal handler can only be called once
			logConfig.onFatal = [];
			for (const handler of handlers) {
				try {
					handler();
				} catch (error) {
					try {
						this.error('Error while running error handler: ', error);
					} catch {
						// Ignored
					}
				}
			}
		}
	}

	/**
	 * Generates new Logger instance which will have all messages prefixed by this string
	 * @param str - The string all messages should be prefixed with
	 * @returns New logger instance with said prefix
	 */
	public prefixMessages(str: string): Logger {
		return new Logger(this.category, this.prefix + ' ' + str);
	}

	/**
	 * Wraps the string in ANSI color escape sequence, first setting color and than resetting it
	 * @see https://en.wikipedia.org/wiki/ANSI_escape_code#3-bit_and_4-bit
	 * @param str - The string that should be colorized
	 * @param color - The color to use
	 * @returns The wrapped string
	 */
	public wrapColor(str: string, color: string): string {
		return `\x1b[${color}m${str}\x1b[0m`;
	}

	/** Creates a log header based on log configuration and loglevel */
	private logHeader(logLevel: LogLevel, color: boolean): string {
		let result = '';
		// Add time, if we should
		if (logConfig.printTime) {
			result += new Date().toLocaleString(logConfig.timeLocale, { timeZone: 'UTC' }).replace(',', '');
			if (color) {
				result = this.wrapColor(result, '90');
			}
			result += ' ';
		}
		// Add loglevel of the message
		if (color) {
			result += this.wrapColor(LOG_NAMES[logLevel], LOG_COLORS[logLevel]);
		} else {
			result += LOG_NAMES[logLevel];
		}
		// Add prefix specific to this logger instance
		return result + ' ' + this.prefix;
	}

	public toString(): string {
		return '[class Logger]';
	}
}

/** Custom function for stringifying data when logging */
export function AnyToString(data: unknown): string {
	if (typeof data === 'string') {
		return data;
	}

	if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
		if (data instanceof Error) {
			return data.stack ? `[${data.stack}\n]` : `[Error ${data.name}: ${data.message}]`;
		}
		if ('toString' in data) {
			// eslint-disable-next-line @typescript-eslint/no-base-to-string
			const customString = String(data);
			if (customString !== '[object Object]') {
				return customString;
			}
		} else {
			return '[object null]';
		}
	}

	return (
		JSON.stringify(data, (_k, v) => {
			if (typeof v === 'object' && v !== null && v !== data) {
				if (Array.isArray(v))
					return '[object Array]';
				if ('toString' in v)
					return String(v);
				return '[object null]';
			}
			// eslint-disable-next-line @typescript-eslint/no-unsafe-return
			return v;
		}) ?? 'undefined'
	);
}
