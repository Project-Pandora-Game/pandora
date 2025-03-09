import { logConfig, LogLevel, SetConsoleOutput } from '../src/logging.ts';

// Logging setup
SetConsoleOutput(LogLevel.FATAL);
logConfig.onFatal.push(() => {
	throw new Error('Fatal error happened');
});
