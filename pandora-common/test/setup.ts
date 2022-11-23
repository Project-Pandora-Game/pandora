import { logConfig, LogLevel, SetConsoleOutput } from '../src/logging';

// Logging setup
SetConsoleOutput(LogLevel.FATAL);
logConfig.onFatal.push(() => {
	fail('Fatal error happened');
});
