import _ from 'lodash';
import { GetLogger, Logger, LogLevel, logConfig, SetConsoleOutput, LogOutputDefinition } from '../src/logging';

describe('GetLogger()', () => {
	it('should return an instance of Logger', () => {
		expect(GetLogger('mock')).toBeInstanceOf(Logger);
	});
});

describe('SetConsoleOutput()', () => {
	const mockConsole = jest.spyOn(console, 'info').mockImplementation((_message) => { /**nothing */ });
	const mockLogger = GetLogger('mock');
	it('should set the logLevel of the console output', () => {
		SetConsoleOutput(LogLevel.ERROR);

		mockLogger.info('hello');
		//INFO = 3 > ERROR = 0; output should not be called
		expect(mockConsole).not.toHaveBeenCalled();
	});
});

describe('Logger', () => {
	const mockOnMessage = jest.fn((_prefix, _message) => {/**nothing */ });
	const mockFatalHandler = jest.fn();
	const mockLogOutput: LogOutputDefinition = {
		logLevel: LogLevel.VERBOSE,
		supportsColor: true,
		logLevelOverrides: {},
		onMessage: mockOnMessage,
	};
	let onFatalBackup: (() => void)[] = [];
	beforeAll(() => {
		onFatalBackup = logConfig.onFatal;
		logConfig.logOutputs.push(mockLogOutput);
		logConfig.onFatal = [mockFatalHandler];
	});
	afterAll(() => {
		_.remove(logConfig.logOutputs, (o) => o === mockLogOutput);
		logConfig.onFatal = onFatalBackup;
	});

	describe('shortcuts', () => {
		const mockLogger = GetLogger('mock');
		const mockLogMessage = jest.fn((_level: LogLevel, _message: unknown[]) => {/*nothing*/ });
		mockLogger.logMessage = mockLogMessage;
		beforeEach(() => {
			mockLogMessage.mockClear();
		});
		it('debug() should call logMessage with LogLevel.DEBUG', () => {
			mockLogger.debug('debugging');
			expect(mockLogMessage).toHaveBeenCalledTimes(1);
			expect(mockLogMessage).toHaveBeenNthCalledWith(1, LogLevel.DEBUG, ['debugging']);
		});
		it('verbose() should call logMessage with LogLevel.VERBOSE', () => {
			mockLogger.verbose('verbosing');
			expect(mockLogMessage).toHaveBeenCalledTimes(1);
			expect(mockLogMessage).toHaveBeenNthCalledWith(1, LogLevel.VERBOSE, ['verbosing']);
		});
		it('info() should call logMessage with LogLevel.INFO', () => {
			mockLogger.info('infoing');
			expect(mockLogMessage).toHaveBeenCalledTimes(1);
			expect(mockLogMessage).toHaveBeenNthCalledWith(1, LogLevel.INFO, ['infoing']);
		});
		it('log() should call logMessage with LogLevel.INFO', () => {
			mockLogger.log('logging');
			expect(mockLogMessage).toHaveBeenCalledTimes(1);
			expect(mockLogMessage).toHaveBeenNthCalledWith(1, LogLevel.INFO, ['logging']);
		});
		it('alert() should call logMessage with LogLevel.ALERT', () => {
			mockLogger.alert('alerting');
			expect(mockLogMessage).toHaveBeenCalledTimes(1);
			expect(mockLogMessage).toHaveBeenNthCalledWith(1, LogLevel.ALERT, ['alerting']);
		});
		it('warning() should call logMessage with LogLevel.WARNING', () => {
			mockLogger.warning('warning');
			expect(mockLogMessage).toHaveBeenCalledTimes(1);
			expect(mockLogMessage).toHaveBeenNthCalledWith(1, LogLevel.WARNING, ['warning']);
		});
		it('error() should call logMessage with LogLevel.ERROR', () => {
			mockLogger.error('erroring');
			expect(mockLogMessage).toHaveBeenCalledTimes(1);
			expect(mockLogMessage).toHaveBeenNthCalledWith(1, LogLevel.ERROR, ['erroring']);
		});
		it('fatal() should call logMessage with LogLevel.FATAL', () => {
			mockLogger.fatal('fatality');
			expect(mockLogMessage).toHaveBeenCalledTimes(1);
			expect(mockLogMessage).toHaveBeenNthCalledWith(1, LogLevel.FATAL, ['fatality']);
		});
	});

	describe('logMessage()', () => {
		//disable console for this test
		jest.spyOn(console, 'info').mockImplementation(() => { /**nothing */ });

		const mockLogger = GetLogger('mock');
		beforeEach(() => {
			mockOnMessage.mockClear();
			mockFatalHandler.mockClear();
		});
		it('should call output.onMessage', () => {
			mockLogger.logMessage(LogLevel.INFO, ['hi']);
			expect(mockOnMessage).toHaveBeenCalledTimes(1);
			expect(mockOnMessage).toHaveBeenNthCalledWith(1, expect.stringContaining('mock'), expect.arrayContaining(['hi']), LogLevel.INFO);
		});
		it('should not call output.onMessage when LogLevel is lower', () => {
			mockLogger.logMessage(LogLevel.DEBUG, ['im invisible']);
			expect(mockOnMessage).not.toHaveBeenCalled();
		});

		it('should also call all onFatal handlers', () => {
			mockLogger.fatal('this is fatal!');
			expect(mockOnMessage).toHaveBeenCalledTimes(1);
			expect(mockFatalHandler).toHaveBeenCalledTimes(1);
		});
	});

	describe('prefixMessages()', () => {
		const mockLogger = GetLogger('mock');
		it('should return new instanceof Logger', () => {
			const instance = mockLogger.prefixMessages('meh');
			expect(instance).toBeInstanceOf(Logger);
			expect(instance).not.toEqual(mockLogger);
		});

		it('should return new Logger with provided prefix', () => {
			mockLogger.prefixMessages('yay prefixed').log('something');
			expect(mockOnMessage).toHaveBeenCalledTimes(1);
			expect(mockOnMessage).toHaveBeenNthCalledWith(1, expect.stringContaining('[mock] yay prefixed'), expect.arrayContaining(['something']), LogLevel.INFO);
		});
	});
});
