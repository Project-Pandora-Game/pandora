import { GetLogger, IEmpty } from 'pandora-common';
import { CharacterManager } from './character/characterManager';
import { StopHttpServer } from './networking/httpServer';
import { DirectoryConnector } from './networking/socketio_directory_connector';

const logger = GetLogger('Lifecycle');

let stopping: Promise<IEmpty> | undefined;
const STOP_TIMEOUT = 10_000;

async function StopGracefully(): Promise<IEmpty> {
	// Disconnect all characters
	await CharacterManager.removeAllCharacters();
	StopHttpServer();
	// TODO: Disconnect database
	// The result of promise from graceful stop is used by Directory, disconnect afterwards
	setTimeout(() => {
		DirectoryConnector?.disconnect();
	}, 200);
	return {};
}

export function Stop(): Promise<IEmpty> {
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
}
