import { GetLogger, ServerService, logConfig } from 'pandora-common';
import wtfnode from 'wtfnode';
import { accountManager } from './account/accountManager.ts';
import { GetDatabaseService } from './database/databaseProvider.ts';
import { HttpServer } from './networking/httpServer.ts';
import { ConnectionManagerClient } from './networking/manager_client.ts';
import { BetaRegistrationService } from './services/betaRegistration/betaRegistration.ts';
import { DiscordBot } from './services/discord/discordBot.ts';
import { GitHubVerifier } from './services/github/githubVerify.ts';
import { ShardManager } from './shard/shardManager.ts';
import { SpaceManager } from './spaces/spaceManager.ts';

const logger = GetLogger('Lifecycle');

{
	const wtfNodeLogger = GetLogger('wtfnode');
	wtfnode.setLogger('info', (...message) => wtfNodeLogger.info(...message));
	wtfnode.setLogger('warn', (...message) => wtfNodeLogger.warning(...message));
	wtfnode.setLogger('error', (...message) => wtfNodeLogger.error(...message));
}

let destroying: string | undefined;
let stopping: Promise<void> | undefined;
const STOP_TIMEOUT = 15_000;

function DestroyService(service: ServerService): Promise<void> | void {
	destroying = service.constructor.name;
	return service.onDestroy?.();
}

export function IsStopping(): boolean {
	return stopping !== undefined;
}

async function StopGracefully(): Promise<void> {
	// Stop listening for IPC
	process.off('message', IPCMessageListener);
	// Stop HTTP server
	await DestroyService(HttpServer);
	// Stop APIs
	await DestroyService(DiscordBot);
	await DestroyService(GitHubVerifier);
	await DestroyService(BetaRegistrationService);
	// Stop sending status updates
	await DestroyService(ConnectionManagerClient);
	// Unload all shards
	await DestroyService(ShardManager);
	// Unload all characters
	destroying = 'AccountManager Characters';
	await accountManager.onDestroyCharacters();
	// Unload all spaces
	await DestroyService(SpaceManager);
	// Unload all accounts
	destroying = 'AccountManager Accounts';
	accountManager.onDestroyAccounts();
	// Disconnect database
	await DestroyService(GetDatabaseService());
	destroying = '[done]';
}

export function Stop(): Promise<void> {
	if (stopping !== undefined)
		return stopping;
	logger.alert('Stopping...');
	setTimeout(() => {
		logger.fatal(`Stop timed out! Destroying ${destroying ?? 'unknown service'}!`);
		// Dump what is running
		wtfnode.dump();
		// Force exit the process
		process.exit();
	}, STOP_TIMEOUT).unref();
	// Graceful stop syncs everything with directory and database
	stopping = StopGracefully()
		.catch((err) => {
			logger.fatal(`Stop errored at ${destroying}:\n`, err);
			// Force exit the process
			process.exit();
		});
	return stopping;
}

function IPCMessageListener(message: unknown) {
	if (message === 'STOP') {
		logger.info('Received STOP message');
		void Stop();
	}
}

export function SetupSignalHandling(): void {
	process.on('SIGINT', () => {
		logger.info('Received SIGINT');
		void Stop();
	});

	process.on('SIGTERM', () => {
		logger.info('Received SIGTERM');
		void Stop();
	});

	process.on('message', IPCMessageListener);

	process.on('exit', () => {
		logger.alert('Stopped.');
	});

	logConfig.onFatal.push(() => {
		logger.info('Fatal error detected, stopping');
		process.exitCode = 2;
		void Stop();
	});
}
