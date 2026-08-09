import { existsSync } from 'fs';
import { AnyToString, GetLogger, logConfig, LogLevel, type LogOutputDefinition } from 'pandora-common';
import { loadEnvFile } from 'process';
import { RunCliCommand } from './cliCommandRunner.ts';
import { GenerateCliServices } from './services/cliServices.ts';

{
	const nodeLogger = GetLogger('Node');
	process.on('warning', (warning) => {
		nodeLogger.warning(warning);
	});
}

/**
 * Run the CLI.
 */

async function Run(): Promise<void> {
	// Setup logging specially for CLI: Only ever log to the stderr
	const consoleOutput: LogOutputDefinition = {
		logLevel: LogLevel.VERBOSE,
		logLevelOverrides: {},
		supportsColor: true,
		onMessage: (prefix, message) => {
			const line = [prefix, ...message.map((v) => AnyToString(v))].join(' ') + '\n';
			process.stderr.write(line, 'utf8');
		},
	};
	logConfig.logOutputs = [
		consoleOutput,
	];

	const logger = GetLogger('CLI');

	// Load environment variables from .env file
	if (existsSync('./.env')) {
		loadEnvFile('./.env');
		logger.debug('Loaded .env file');
	}

	// Init the CLI service manager
	const serviceManager = GenerateCliServices();
	await serviceManager.load();

	logger.debug('CLI Services loaded');

	logger.debug('Running command...');
	try {
		await RunCliCommand(serviceManager, process.argv.slice(2));
		logger.debug('Command runner completed');
	} catch (err) {
		logger.fatal('Error running command:\n', err);
		process.exitCode = 2;
	}

	// Cleanup
	serviceManager.services.apiManager?.close();
}

await Run();
