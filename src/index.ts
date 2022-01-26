import { mkdirSync } from 'fs';
import { InitAccountManager } from './account/accountManager';
import { APP_NAME } from './config';
import { InitDatabase } from './database/databaseProvider';
import { AddFileOutput } from './logging';
import { GetLogger, LogLevel, SetConsoleOutput } from 'pandora-common/dist/logging';
import { StartHttpServer } from './networking/httpServer';

const LOG_DIR = './logs';
const logger = GetLogger('init');

start().catch((error) => {
	logger.fatal('Init failed:', error);
});

/**
 * Starts the application.
 */
async function start(): Promise<void> {
	setupLogging();
	logger.info(`${APP_NAME} starting...`);
	logger.debug('Initializing database...');
	await InitDatabase();
	logger.debug('Initializing managers...');
	InitAccountManager();
	logger.debug('Starting HTTP server...');
	await StartHttpServer();
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
