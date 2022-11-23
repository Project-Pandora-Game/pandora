import { GetLogger, Logger, LogLevel, logConfig, SetConsoleOutput } from '../src/logging';

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
		expect(mockConsole.mock.calls.length).toBe(0);
	});
});

describe('Logger', () => {
	const mockOnMessage = jest.fn((_prefix, _message) => {/**nothing */ });
	const mockFatalHandler = jest.fn();
	const mockLogOutput = {
		logLevel: LogLevel.VERBOSE,
		supportsColor: true,
		logLevelOverrides: {},
		onMessage: mockOnMessage,
	};
	logConfig.logOutputs.push(mockLogOutput);
	logConfig.onFatal.push(mockFatalHandler);

	describe('shortcuts', () => {
		const mockLogger = GetLogger('mock');
		const mockLogMessage = jest.fn((_level: LogLevel, _message: unknown[]) => {/*nothing*/ });
		mockLogger.logMessage = mockLogMessage;
		beforeEach(() => {
			mockLogMessage.mockClear();
		});
		it('debug() should call logMessage with LogLevel.DEBUG', () => {
			mockLogger.debug('debugging');
			expect(mockLogMessage.mock.calls.length).toBe(1);
			expect(mockLogMessage.mock.calls[0][0]).toBe(LogLevel.DEBUG);
			expect(mockLogMessage.mock.calls[0][1]).toEqual(['debugging']);
		});
		it('verbose() should call logMessage with LogLevel.VERBOSE', () => {
			mockLogger.verbose('verbosing');
			expect(mockLogMessage.mock.calls.length).toBe(1);
			expect(mockLogMessage.mock.calls[0][0]).toBe(LogLevel.VERBOSE);
			expect(mockLogMessage.mock.calls[0][1]).toEqual(['verbosing']);
		});
		it('info() should call logMessage with LogLevel.INFO', () => {
			mockLogger.info('infoing');
			expect(mockLogMessage.mock.calls.length).toBe(1);
			expect(mockLogMessage.mock.calls[0][0]).toBe(LogLevel.INFO);
			expect(mockLogMessage.mock.calls[0][1]).toEqual(['infoing']);
		});
		it('log() should call logMessage with LogLevel.INFO', () => {
			mockLogger.log('logging');
			expect(mockLogMessage.mock.calls.length).toBe(1);
			expect(mockLogMessage.mock.calls[0][0]).toBe(LogLevel.INFO);
			expect(mockLogMessage.mock.calls[0][1]).toEqual(['logging']);
		});
		it('alert() should call logMessage with LogLevel.ALERT', () => {
			mockLogger.alert('alerting');
			expect(mockLogMessage.mock.calls.length).toBe(1);
			expect(mockLogMessage.mock.calls[0][0]).toBe(LogLevel.ALERT);
			expect(mockLogMessage.mock.calls[0][1]).toEqual(['alerting']);
		});
		it('warning() should call logMessage with LogLevel.WARNING', () => {
			mockLogger.warning('warning');
			expect(mockLogMessage.mock.calls.length).toBe(1);
			expect(mockLogMessage.mock.calls[0][0]).toBe(LogLevel.WARNING);
			expect(mockLogMessage.mock.calls[0][1]).toEqual(['warning']);
		});
		it('error() should call logMessage with LogLevel.ERROR', () => {
			mockLogger.error('erroring');
			expect(mockLogMessage.mock.calls.length).toBe(1);
			expect(mockLogMessage.mock.calls[0][0]).toBe(LogLevel.ERROR);
			expect(mockLogMessage.mock.calls[0][1]).toEqual(['erroring']);
		});
		it('fatal() should call logMessage with LogLevel.FATAL', () => {
			mockLogger.fatal('fatality');
			expect(mockLogMessage.mock.calls.length).toBe(1);
			expect(mockLogMessage.mock.calls[0][0]).toBe(LogLevel.FATAL);
			expect(mockLogMessage.mock.calls[0][1]).toEqual(['fatality']);
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
			expect(mockOnMessage.mock.calls.length).toBe(1);
			expect(mockOnMessage.mock.calls[0][0]).toContain('mock');
			expect(mockOnMessage.mock.calls[0][1]).toContain('hi');
		});
		it('should not call output.onMessage when LogLevel is lower', () => {
			mockLogger.logMessage(LogLevel.DEBUG, ['im invisible']);
			expect(mockOnMessage.mock.calls.length).toBe(0);
		});

		it('should also call all onFatal handlers', () => {
			mockLogger.fatal('this is fatal!');
			expect(mockOnMessage.mock.calls.length).toBe(2);
			expect(mockFatalHandler.mock.calls.length).toBe(1);
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
			const call = mockOnMessage.mock.calls[0];
			expect(call[0]).toContain('[mock] yay prefixed');
			expect(call[1]).toContain('something');
		});
	});
});
