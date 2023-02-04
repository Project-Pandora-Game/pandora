import { mkdirSync } from 'fs';
import { APP_NAME, APP_VERSION, LOG_DIR, LOG_DISCORD_WEBHOOK_URL, LOG_PRODUCTION, SERVER_PUBLIC_ADDRESS } from './config';
import { AddDiscordLogOutput, AddFileOutput } from './logging';
import { GetLogger, LogLevel, ServiceManager, SetConsoleOutput } from 'pandora-common';
import { ConnectToDirectory } from './networking/socketio_directory_connector';
import { HttpServer } from './networking/httpServer';
import { CreateDatabase } from './database/databaseProvider';
import { SetupSignalHandling } from './lifecycle';
import { LoadAssetDefinitions } from './assets/assetManager';
// get version from package.json

const logger = GetLogger('init');

const manager = new ServiceManager(logger);

Start().catch((error) => {
	logger.fatal('Init failed:', error);
});

/**
 * Starts the application.
 */
async function Start(): Promise<void> {
	SetupSignalHandling();
	SetupLogging();
	await manager
		.log(LogLevel.INFO, `${APP_NAME} v${APP_VERSION} starting...`)
		.log(LogLevel.VERBOSE, 'Loading asset definitions...')
		.action(LoadAssetDefinitions)
		.log(LogLevel.VERBOSE, 'Connecting to Directory...')
		.action(ConnectToDirectory)
		.add(CreateDatabase())
		.log(LogLevel.VERBOSE, 'Starting HTTP server...')
		.add(HttpServer)
		.log(LogLevel.ALERT, 'Ready!')
		.build();
}

/**
 * Configures logging for the application.
 */
function SetupLogging(): void {
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
		AddFileOutput(`${LOG_DIR}/${logPrefix}_debug.log`, false, LogLevel.DEBUG);
		AddFileOutput(`${LOG_DIR}/${logPrefix}_error.log`, true, LogLevel.ALERT);
	}
	// Setup logging to Discord
	if (LOG_DISCORD_WEBHOOK_URL) {
		AddDiscordLogOutput(`${APP_NAME} (${SERVER_PUBLIC_ADDRESS})`, LOG_DISCORD_WEBHOOK_URL, LogLevel.ALERT);
	}
}
