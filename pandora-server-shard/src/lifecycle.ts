import { GetLogger, IEmpty, logConfig } from 'pandora-common';
import { CharacterManager } from './character/characterManager';
import { StopHttpServer } from './networking/httpServer';
import { DirectoryConnector } from './networking/socketio_directory_connector';
import { RoomManager } from './room/roomManager';
import wtfnode from 'wtfnode';
import { CloseDatabase } from './database/databaseProvider';

const logger = GetLogger('Lifecycle');

{
	const wtfNodeLogger = GetLogger('wtfnode');
	wtfnode.setLogger('info', (...message) => wtfNodeLogger.info(...message));
	wtfnode.setLogger('warn', (...message) => wtfNodeLogger.warning(...message));
	wtfnode.setLogger('error', (...message) => wtfNodeLogger.error(...message));
}

let stopping: Promise<IEmpty> | undefined;
const STOP_TIMEOUT = 10_000;

async function StopGracefully(): Promise<IEmpty> {
	// Disconnect all characters
	await CharacterManager.removeAllCharacters();
	// Cleanup all rooms
	await RoomManager.removeAllRooms();
	// Stop HTTP server
	StopHttpServer();
	// Disconnect database
	await CloseDatabase();
	// The result of promise from graceful stop is used by Directory, disconnect afterwards
	setTimeout(() => {
		DirectoryConnector?.disconnect();
	}, 500);
	return {};
}

export function Stop(): Promise<IEmpty> {
	if (stopping !== undefined)
		return stopping;
	logger.alert('Stopping...');
	setTimeout(() => {
		logger.fatal('Stop timed out!');
		// Dump what is running
		wtfnode.dump();
		// Force exit the process
		process.exit();
	}, STOP_TIMEOUT).unref();
	// Graceful stop syncs everything with directory and database
	stopping = StopGracefully()
		.catch((err) => {
			logger.fatal('Stop errored:\n', err);
			// Force exit the process
			process.exit();
		});
	return stopping;
}

let stopRequested = false;

export function RequestStop(): void {
	if (stopRequested)
		return;
	stopRequested = true;
	logger.info('Requesting stop...');
	if (DirectoryConnector) {
		DirectoryConnector.sendMessage('shardRequestStop', {});
		setTimeout(() => {
			if (stopping === undefined) {
				logger.warning('Stop request timed out!');
				void Stop();
			}
		}, STOP_TIMEOUT).unref();
	} else {
		void Stop();
	}
}

export function SetupSignalHandling(): void {
	process.on('SIGINT', () => {
		logger.info('Received SIGINT');
		RequestStop();
	});

	process.on('SIGTERM', () => {
		logger.info('Received SIGTERM');
		RequestStop();
	});

	process.on('exit', () => {
		logger.alert('Stopped.');
	});

	logConfig.onFatal.push(() => {
		logger.info('Fatal error detected, stopping');
		process.exitCode = 2;
		RequestStop();
	});
}
