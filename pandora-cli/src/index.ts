import { ConnectToPandoraApi, WELL_KNOWN_SERVER_ADDRESSES } from 'pandora-api/api';
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

	using pandoraApi = (await ConnectToPandoraApi({
		token: '',
		directoryConnectionAddress: WELL_KNOWN_SERVER_ADDRESSES.localDev,
	})).unwrap();

	const currentToken = (await pandoraApi.token.getCurrentTokenInfo()).unwrap();

	GetLogger('CLI').log('Current token:', JSON.stringify(currentToken, undefined, '  '));
}

await Run();
