import { mkdirSync } from 'fs';
import { accountManager } from './account/accountManager';
import { APP_NAME, APP_VERSION, LOG_DIR, LOG_DISCORD_WEBHOOK_URL, LOG_PRODUCTION } from './config';
import { CreateDatabase } from './database/databaseProvider';
import { AddDiscordLogOutput, AddFileOutput } from './logging';
import { GetLogger, LogLevel, ServiceManager, SetConsoleOutput } from 'pandora-common';
import { HttpServer } from './networking/httpServer';
import GetEmailSender from './services/email';
import { SetupSignalHandling } from './lifecycle';
import { ConnectionManagerClient } from './networking/manager_client';
import { GitHubVerifier } from './services/github/githubVerify';
import { ShardTokenStore } from './shard/shardTokenStore';
import { DiscordBot } from './services/discord/discordBot';
import { BetaKeyStore } from './shard/betaKeyStore';
import { ShardManager } from './shard/shardManager';

const logger = GetLogger('init');

const manager = new ServiceManager(logger);

const STOP_PHASES = {
	ACCOUNTS: 1,
	DATABASE: 2,
	HTTP_SERVER: 3,
} as const;

Start().catch((error) => {
	logger.fatal('Init failed:', error);
});

/**
 * Starts the application.
 */
async function Start(): Promise<void> {
	SetupSignalHandling(() => manager.destroy());
	SetupLogging();
	await manager
		.log(LogLevel.INFO, `${APP_NAME} v${APP_VERSION} starting...`)
		.add(GetEmailSender())
		.add(DiscordBot)
		.log(LogLevel.VERBOSE, 'Initializing database...')
		.add(CreateDatabase(), STOP_PHASES.DATABASE)
		.add(ShardTokenStore)
		.add(BetaKeyStore)
		.log(LogLevel.VERBOSE, 'Initializing managers...')
		.add(accountManager, STOP_PHASES.ACCOUNTS)
		.add(ConnectionManagerClient)
		.add(ShardManager)
		.log(LogLevel.VERBOSE, 'Initializing APIs...')
		.add(GitHubVerifier)
		.log(LogLevel.VERBOSE, 'Starting HTTP server...')
		.add(HttpServer, STOP_PHASES.HTTP_SERVER)
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
