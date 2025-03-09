import { mkdirSync } from 'fs';
import { GetLogger, LogLevel, ServiceInit, SetConsoleOutput } from 'pandora-common';
import { accountManager } from './account/accountManager.ts';
import { ENV } from './config.ts';
import { GetDatabaseService } from './database/databaseProvider.ts';
import { SetupSignalHandling } from './lifecycle.ts';
import { AddDiscordLogOutput, AddFileOutput } from './logging.ts';
import { HttpServer } from './networking/httpServer.ts';
import { ConnectionManagerClient } from './networking/manager_client.ts';
import { BetaRegistrationService } from './services/betaRegistration/betaRegistration.ts';
import { DiscordBot } from './services/discord/discordBot.ts';
import GetEmailSender from './services/email/index.ts';
import { GitHubVerifier } from './services/github/githubVerify.ts';
import { BetaKeyStore } from './shard/betaKeyStore.ts';
import { ShardTokenStore } from './shard/shardTokenStore.ts';
import { SpaceManager } from './spaces/spaceManager.ts';
const { APP_NAME, LOG_DIR, LOG_DISCORD_WEBHOOK_URL, LOG_PRODUCTION } = ENV;

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
	logger.info(`${APP_NAME} starting...`);
	await ServiceInit(GetEmailSender());
	logger.verbose('Initializing database...');
	await ServiceInit(GetDatabaseService());
	await ServiceInit(ShardTokenStore);
	await ServiceInit(BetaKeyStore);
	logger.verbose('Initializing managers...');
	await ServiceInit(accountManager);
	await ServiceInit(SpaceManager);
	await ServiceInit(ConnectionManagerClient);
	await ServiceInit(BetaRegistrationService);
	logger.verbose('Initializing APIs...');
	await ServiceInit(GitHubVerifier);
	await ServiceInit(DiscordBot);
	logger.verbose('Starting HTTP server...');
	await ServiceInit(HttpServer);
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
		let logPrefix = `directory`;
		// In production mode prefix with PID and time of start
		if (LOG_PRODUCTION) {
			const time = new Date();
			const timestring = `${time.getFullYear() % 100}${(time.getMonth() + 1).toString().padStart(2, '0')}${time.getDate().toString().padStart(2, '0')}_` +
				`${time.getHours().toString().padStart(2, '0')}${time.getMinutes().toString().padStart(2, '0')}`;
			logPrefix += `_${timestring}_${process.pid}`;
		}
		await AddFileOutput(`${LOG_DIR}/${logPrefix}_debug.log`, false, LogLevel.DEBUG);
		await AddFileOutput(`${LOG_DIR}/${logPrefix}_error.log`, true, LogLevel.ALERT);
		await AddFileOutput(`${LOG_DIR}/_audit.log`, true, false, { audit: LogLevel.DEBUG });
	}
	// Setup logging to Discord
	if (LOG_DISCORD_WEBHOOK_URL) {
		AddDiscordLogOutput(APP_NAME, LOG_DISCORD_WEBHOOK_URL, LogLevel.ALERT);
	}
}
