import { logConfig, LogLevel, SetConsoleOutput } from 'pandora-common';

// Logging setup
SetConsoleOutput(LogLevel.FATAL);
logConfig.onFatal.push(() => {
	throw new Error('Fatal error happened');
});
