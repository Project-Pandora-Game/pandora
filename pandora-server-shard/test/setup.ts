import { logConfig, LogLevel, SetConsoleOutput } from 'pandora-common';

// Logging setup
SetConsoleOutput(LogLevel.FATAL);
logConfig.onFatal.push(() => {
	fail('Fatal error happened');
});
