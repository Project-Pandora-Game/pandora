import { mkdirSync } from 'fs';
import { APP_NAME } from './config';
import { AddFileOutput, GetLogger, LogLevel, SetConsoleOutput } from './logging';
import { ConnectToDirectory } from './networking/directoryConnection';
import { StartHttpServer } from './networking/server';

const LOG_DIR = './logs';
const logger = GetLogger('init');

Start().catch((error) => {
	logger.fatal('Init failed:', error);
});

/**
 * Starts the application.
 */
async function Start(): Promise<void> {
	SetupLogging();
	logger.info(`${APP_NAME} starting...`);
	logger.debug('Connecting to Directory...');
	await ConnectToDirectory();
	logger.debug('Starting HTTP server...');
	await StartHttpServer();
}

/**
 * Configures logging for the application.
 */
function SetupLogging(): void {
	mkdirSync(LOG_DIR, { recursive: true });
	SetConsoleOutput(LogLevel.DEBUG);
	AddFileOutput(`${LOG_DIR}/debug.log`, false, LogLevel.DEBUG);
	AddFileOutput(`${LOG_DIR}/error.log`, true, LogLevel.ALERT);
}
