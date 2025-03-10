import { GetLogger, IEmpty, ServerService, logConfig } from 'pandora-common';
import wtfnode from 'wtfnode';
import { CharacterManager } from './character/characterManager.ts';
import { GetDatabaseService } from './database/databaseProvider.ts';
import { HttpServer } from './networking/httpServer.ts';
import { DirectoryConnector } from './networking/socketio_directory_connector.ts';
import { SpaceManager } from './spaces/spaceManager.ts';

const logger = GetLogger('Lifecycle');

{
	const wtfNodeLogger = GetLogger('wtfnode');
	wtfnode.setLogger('info', (...message) => wtfNodeLogger.info(...message));
	wtfnode.setLogger('warn', (...message) => wtfNodeLogger.warning(...message));
	wtfnode.setLogger('error', (...message) => wtfNodeLogger.error(...message));
}

let destroying = 'unknown service';
let stopping: Promise<IEmpty> | undefined;
const STOP_TIMEOUT = 10_000;

function DestroyService(service: ServerService): Promise<void> | void {
	destroying = service.constructor.name;
	return service.onDestroy?.();
}

async function StopGracefully(): Promise<IEmpty> {
	// Stop listening for IPC
	process.off('message', IPCMessageListener);
	// Disconnect all characters
	destroying = 'CharacterManager';
	await CharacterManager.removeAllCharacters();
	// Cleanup all rooms
	destroying = 'RoomManager';
	await SpaceManager.removeAllSpaces();
	// Stop HTTP server
	await DestroyService(HttpServer);
	// Disconnect database
	await DestroyService(GetDatabaseService());
	// The result of promise from graceful stop is used by Directory, disconnect afterwards
	destroying = 'DirectoryConnector';
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
		logger.fatal(`Stop timed out! Destroying ${destroying}!`);
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

function IPCMessageListener(message: unknown) {
	if (message === 'STOP') {
		logger.info('Received STOP message');
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

	process.on('message', IPCMessageListener);

	process.on('exit', () => {
		logger.alert('Stopped.');
	});

	logConfig.onFatal.push(() => {
		logger.info('Fatal error detected, stopping');
		process.exitCode = 2;
		RequestStop();
	});
}
