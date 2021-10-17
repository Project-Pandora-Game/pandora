import { AddFileOutput, GetLogger, LogLevel, SetConsoleOutput } from './logging';

SetConsoleOutput(LogLevel.DEBUG);
AddFileOutput('./debug.log', false, LogLevel.DEBUG);
AddFileOutput('./error.log', true, LogLevel.ALERT);

const logger = GetLogger('init');

logger.alert('Hello world!');
