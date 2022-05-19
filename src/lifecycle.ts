import { GetLogger } from 'pandora-common';
import { accountManager } from './account/accountManager';
import { CloseDatabase } from './database/databaseProvider';
import { StopHttpServer } from './networking/httpServer';
import { ShardManager } from './shard/shardManager';

const logger = GetLogger('Lifecycle');

let stopping: Promise<void> | undefined;
const STOP_TIMEOUT = 10_000;

async function StopGracefully(): Promise<void> {
	// Stop HTTP server
	StopHttpServer();
	// Unload all shards
	ShardManager.onDestroy();
	// Unload all accounts
	accountManager.onDestroy();
	// Disconnect database
	await CloseDatabase();
}

export function Stop(): Promise<void> {
	if (stopping !== undefined)
		return stopping;
	logger.alert('Stopping...');
	setTimeout(() => {
		logger.fatal('Stop timed out!');
		// Even though it is error, we exit with 0 to prevent container restart from triggering
		process.exit(0);
	}, STOP_TIMEOUT).unref();
	// Graceful stop syncs everything with directory and database
	stopping = StopGracefully()
		.catch((err) => {
			logger.fatal('Stop errored:\n', err);
			// Even though it is error, we exit with 0 to prevent container restart from triggering
			process.exit(0);
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
}
