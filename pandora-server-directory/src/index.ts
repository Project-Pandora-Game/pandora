import { mkdirSync } from 'fs';
import { accountManager } from './account/accountManager';
import { APP_NAME, LOG_DIR, LOG_DISCORD_WEBHOOK_URL, LOG_PRODUCTION } from './config';
import { InitDatabase } from './database/databaseProvider';
import { AddDiscordLogOutput, AddFileOutput } from './logging';
import { GetLogger, LogLevel, SetConsoleOutput } from 'pandora-common';
import { StartHttpServer } from './networking/httpServer';
import GetEmailSender from './services/email';
import { SetupSignalHandling } from './lifecycle';
import { ConnectionManagerClient } from './networking/manager_client';
import { GitHubVerifier } from './services/github/githubVerify';
import { ShardTokenStore } from './shard/shardTokenStore';
import { DiscordBot } from './services/discord/discordBot';
import { BetaKeyStore } from './shard/betaKeyStore';

const logger = GetLogger('init');

Start().catch((error) => {
	logger.fatal('Init failed:', error);
});

/**
 * Starts the application.
 */
async function Start(): Promise<void> {
	SetupSignalHandling();
	SetupLogging();
	logger.info(`${APP_NAME} starting...`);
	await GetEmailSender().init();
	await DiscordBot.init();
	logger.verbose('Initializing database...');
	await InitDatabase();
	await ShardTokenStore.init();
	await BetaKeyStore.init();
	logger.verbose('Initializing managers...');
	await accountManager.init();
	ConnectionManagerClient.init();
	logger.verbose('Initializing APIs...');
	await GitHubVerifier.init();
	logger.verbose('Starting HTTP server...');
	await StartHttpServer();
	logger.alert('Ready!');
}

/**
 * Configures logging for the application.
 */
function SetupLogging(): void {
	SetConsoleOutput(LOG_PRODUCTION ? LogLevel.VERBOSE : LogLevel.DEBUG);
	// Setup logging into file
	if (LOG_DIR) {
		mkdirSync(LOG_DIR, { recursive: true });
		let logPrefix = `directory`;
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
		AddDiscordLogOutput(APP_NAME, LOG_DISCORD_WEBHOOK_URL, LogLevel.ALERT);
	}
}
