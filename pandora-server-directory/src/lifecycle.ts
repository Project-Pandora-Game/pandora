import { GetLogger, Service, logConfig } from 'pandora-common';
import { accountManager } from './account/accountManager';
import { CloseDatabase } from './database/databaseProvider';
import { StopHttpServer } from './networking/httpServer';
import { ConnectionManagerClient } from './networking/manager_client';
import { ShardManager } from './shard/shardManager';
import wtfnode from 'wtfnode';
import { DiscordBot } from './services/discord/discordBot';
import { RoomManager } from './room/roomManager';

const logger = GetLogger('Lifecycle');

{
	const wtfNodeLogger = GetLogger('wtfnode');
	wtfnode.setLogger('info', (...message) => wtfNodeLogger.info(...message));
	wtfnode.setLogger('warn', (...message) => wtfNodeLogger.warning(...message));
	wtfnode.setLogger('error', (...message) => wtfNodeLogger.error(...message));
}

let destroying: string | undefined;
let stopping: Promise<void> | undefined;
const STOP_TIMEOUT = 10_000;

function DestroyService(service: Service & object): Promise<void> | void {
	destroying = service.constructor.name;
	return service.onDestroy?.();
}

async function StopGracefully(): Promise<void> {
	// Stop HTTP server
	destroying = 'HTTP Server';
	StopHttpServer();
	// Stop discord bot
	await DestroyService(DiscordBot);
	// Stop sending status updates
	await DestroyService(ConnectionManagerClient);
	// Unload all shards
	await DestroyService(ShardManager);
	// Unload all characters
	destroying = 'AccountManager Characters';
	await accountManager.onDestroyCharacters();
	// Unload all rooms
	await DestroyService(RoomManager);
	// Unload all accounts
	destroying = 'AccountManager Accounts';
	accountManager.onDestroyAccounts();
	// Disconnect database
	destroying = 'AccountManager Database';
	await CloseDatabase();
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

export function SetupSignalHandling(): void {
	process.on('SIGINT', () => {
		logger.info('Received SIGINT');
		void Stop();
	});

	process.on('SIGTERM', () => {
		logger.info('Received SIGTERM');
		void Stop();
	});

	process.on('exit', () => {
		logger.alert('Stopped.');
	});

	logConfig.onFatal.push(() => {
		logger.info('Fatal error detected, stopping');
		process.exitCode = 2;
		void Stop();
	});
}
