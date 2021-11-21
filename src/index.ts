import { mkdirSync } from 'fs';
import { APP_NAME } from './config';
import { AddFileOutput, GetLogger, LogLevel, SetConsoleOutput } from './logging';

const LOG_DIR = './logs';
const logger = GetLogger('init');

// eslint-disable-next-line @typescript-eslint/no-floating-promises
start();

/**
 * Starts the application.
 */
function start(): void {
	setupLogging();
	logger.info(`${APP_NAME} starting...`);
}

/**
 * Configures logging for the application.
 */
function setupLogging(): void {
	mkdirSync(LOG_DIR, { recursive: true });
	SetConsoleOutput(LogLevel.DEBUG);
	AddFileOutput(`${LOG_DIR}/debug.log`, false, LogLevel.DEBUG);
	AddFileOutput(`${LOG_DIR}/error.log`, true, LogLevel.ALERT);
}
