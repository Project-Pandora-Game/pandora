import { AnyToString, GetLogger, logConfig, LogLevel } from 'pandora-common';

{
	const nodeLogger = GetLogger('Node');
	process.on('warning', (warning) => {
		nodeLogger.warning(warning);
	});
}

/**
 * Run the CLI.
 */
// eslint-disable-next-line @typescript-eslint/require-await
async function Run(): Promise<void> {
	// Setup logging specially for CLI: Only ever log to the stderr
	logConfig.logOutputs = [
		{
			logLevel: LogLevel.DEBUG,
			logLevelOverrides: {},
			supportsColor: true,
			onMessage: (prefix, message) => {
				const line = [prefix, ...message.map((v) => AnyToString(v))].join(' ') + '\n';
				process.stderr.write(line, 'utf8');
			},
		},
	];

	GetLogger('CLI').info('Hello World!');
}

await Run();
