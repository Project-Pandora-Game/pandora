import { mkdirSync } from 'fs';
import { APP_VERSION, ENV } from './config';
const { APP_NAME, LOG_DIR, LOG_DISCORD_WEBHOOK_URL, LOG_PRODUCTION, SERVER_PUBLIC_ADDRESS } = ENV;
import { AddDiscordLogOutput, AddFileOutput } from './logging';
import { GetLogger, LogLevel, SetConsoleOutput } from 'pandora-common';
import { ConnectToDirectory } from './networking/socketio_directory_connector';
import { StartHttpServer } from './networking/httpServer';
import { InitDatabase } from './database/databaseProvider';
import { SetupSignalHandling } from './lifecycle';
import { LoadAssetDefinitions } from './assets/assetManager';
// get version from package.json

const logger = GetLogger('init');

Start().catch((error) => {
	logger.fatal('Init failed:', error);
	process.exit(1);
});

/**
 * Starts the application.
 */
async function Start(): Promise<void> {
	SetupSignalHandling();
	await SetupLogging();
	logger.info(`${APP_NAME} v${APP_VERSION} starting...`);
	logger.verbose('Loading asset definitions...');
	LoadAssetDefinitions();
	logger.verbose('Connecting to Directory...');
	await ConnectToDirectory();
	logger.verbose('Initializing database...');
	await InitDatabase();
	logger.verbose('Starting HTTP server...');
	await StartHttpServer();
	logger.alert('Ready!');
}

/**
 * Configures logging for the application.
 */
async function SetupLogging(): Promise<void> {
	SetConsoleOutput(LOG_PRODUCTION ? LogLevel.VERBOSE : LogLevel.DEBUG);
	// Setup logging into file
	if (LOG_DIR) {
		mkdirSync(LOG_DIR, { recursive: true });
		let logPrefix = `shard`;
		// In production mode prefix with PID and time of start
		if (LOG_PRODUCTION) {
			const time = new Date();
			const timestring = `${time.getFullYear() % 100}${(time.getMonth() + 1).toString().padStart(2, '0')}${time.getDate().toString().padStart(2, '0')}_` +
				`${time.getHours().toString().padStart(2, '0')}${time.getMinutes().toString().padStart(2, '0')}`;
			logPrefix += `_${timestring}_${process.pid}`;
		}
		await AddFileOutput(`${LOG_DIR}/${logPrefix}_debug.log`, false, LogLevel.DEBUG);
		await AddFileOutput(`${LOG_DIR}/${logPrefix}_error.log`, true, LogLevel.ALERT);
	}
	// Setup logging to Discord
	if (LOG_DISCORD_WEBHOOK_URL) {
		AddDiscordLogOutput(`${APP_NAME} (${SERVER_PUBLIC_ADDRESS})`, LOG_DISCORD_WEBHOOK_URL, LogLevel.ALERT);
	}
}
