import { mkdirSync } from 'fs';
import { InitAccountManager } from './account/accountManager';
import { APP_NAME } from './config';
import { InitDatabase } from './database/databaseProvider';
import { AddFileOutput } from './logging';
import { GetLogger, LogLevel, SetConsoleOutput } from 'pandora-common';
import { StartHttpServer } from './networking/httpServer';
import GetEmailSender from './services/email';

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
	await GetEmailSender().init();
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
function SetupLogging(): void {
	mkdirSync(LOG_DIR, { recursive: true });
	SetConsoleOutput(LogLevel.DEBUG);
	AddFileOutput(`${LOG_DIR}/debug.log`, false, LogLevel.DEBUG);
	AddFileOutput(`${LOG_DIR}/error.log`, true, LogLevel.ALERT);
}
