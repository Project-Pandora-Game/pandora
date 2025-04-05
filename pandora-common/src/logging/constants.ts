import { IS_NODE } from '../utility/misc.ts';

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
export const LOG_COLORS: Readonly<Record<LogLevel, string>> = {
	[LogLevel.FATAL]: IS_NODE ? '41m\x1b[97' : 'background-color: red; color: white;',
	[LogLevel.ERROR]: IS_NODE ? '101m\x1b[30' : 'background-color: red; color: black;',
	[LogLevel.WARNING]: IS_NODE ? '43m\x1b[30' : 'background-color: yellow; color: black;',
	[LogLevel.ALERT]: IS_NODE ? '93' : 'background-color: #222; color: yellow;',
	[LogLevel.INFO]: IS_NODE ? '37' : 'background-color: #222; color: white;',
	[LogLevel.VERBOSE]: IS_NODE ? '32' : 'background-color: #222; color: green;',
	[LogLevel.DEBUG]: IS_NODE ? '34' : 'background-color: #222; color: blue;',
};

/** Visible names for each loglevel */
export const LOG_NAMES: Readonly<Record<LogLevel, string>> = {
	[LogLevel.FATAL]: ' FATAL ',
	[LogLevel.ERROR]: ' ERROR ',
	[LogLevel.WARNING]: 'WARNING',
	[LogLevel.ALERT]: 'ALERT  ',
	[LogLevel.INFO]: 'INFO   ',
	[LogLevel.VERBOSE]: 'VERB   ',
	[LogLevel.DEBUG]: 'DEBUG  ',
};
