import { LOG_COLORS, LOG_NAMES, LogLevel } from './constants.ts';

/** Definition for any log output */
export interface LogOutputDefinition {
	logLevel: LogLevel | false;
	logLevelOverrides: Record<string, LogLevel | false>;
	supportsColor: boolean;
	onMessage: (prefix: string, message: unknown[], level: LogLevel) => void;
	flush?: () => Promise<void>;
}

export interface LoggerConfig {
	/** Controls if log messages should contain file timestamp */
	printTime: boolean;
	/** Sets which locale should be used for time, if it is being displayed */
	timeLocale: string | undefined;
	/** Handlers for when fatal error occurs */
	onFatal: (() => void)[];
	/** List of places log outputs to */
	logOutputs: LogOutputDefinition[];
}

/**
 * Class for logging messages, *immutable*
 */
export class Logger {
	/** Category of this logger instance, used for determining if message should be logged by loglevel */
	public readonly category: string;
	/** Prefix */
	public readonly currentPrefix: string;

	/** Configration of the logger */
	private readonly _loggerConfig: LoggerConfig;

	constructor(category: string, prefix: string, loggerConfig: LoggerConfig) {
		this.category = category;
		this.currentPrefix = prefix;
		this._loggerConfig = loggerConfig;
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
		for (const output of this._loggerConfig.logOutputs) {
			const outputLevel = output.logLevelOverrides[this.category] ?? output.logLevel;
			if (outputLevel !== false && outputLevel >= level) {
				output.onMessage(output.supportsColor ? colorPrefix : plainPrefix, message, level);
			}
		}
		// Fatal messages trigger event
		if (level === LogLevel.FATAL) {
			const handlers = this._loggerConfig.onFatal;
			// Clear onFatal handlers, so each fatal handler can only be called once
			this._loggerConfig.onFatal = [];
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
		return new Logger(this.category, this.currentPrefix + ' ' + str, this._loggerConfig);
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
		if (this._loggerConfig.printTime) {
			result += new Date().toLocaleString(this._loggerConfig.timeLocale, { timeZone: 'UTC' }).replace(',', '');
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
		return result + ' ' + this.currentPrefix;
	}

	public toString(): string {
		return '[class Logger]';
	}
}
