import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { remove } from 'lodash-es';
import { AnyToString, GetLogger, logConfig, Logger, LogLevel, LogOutputDefinition, SetConsoleOutput } from '../src/logging.ts';

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
		remove(logConfig.logOutputs, (o) => o === mockLogOutput);
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

describe('AnyToString()', () => {
	it('returns strings as-is', () => {
		expect(AnyToString('Test string')).toBe('Test string');
	});

	it('prints undefined', () => {
		expect(AnyToString(undefined)).toBe('undefined');
	});

	it('prints null', () => {
		expect(AnyToString(null)).toBe('null');
	});

	it('formats Error', () => {
		const error1 = new SyntaxError('Error message');
		const result = AnyToString(error1);
		// Name the error
		expect(result).toContain(error1.name);
		// Message of the error
		expect(result).toContain(error1.message);
		// Stack of the error
		expect(result).toContain(error1.stack);
	});

	it('formats Error without stack', () => {
		const error1 = new SyntaxError('Error message');
		delete error1.stack;
		const result = AnyToString(error1);
		// Name the error
		expect(result).toContain(error1.name);
		// Message of the error
		expect(result).toContain(error1.message);
	});

	it('uses custom toString in object', () => {
		const result = AnyToString({
			toString: () => 'Custom toString string',
		});
		expect(result).toBe('Custom toString string');
	});

	it('formats object with null prototype', () => {
		const obj = {};
		Object.setPrototypeOf(obj, null);
		expect(AnyToString(obj)).toBe('[object null]');
	});

	it('formats array', () => {
		expect(AnyToString([1, 2, 3])).toBe(JSON.stringify([1, 2, 3]));
	});

	it('skips over inner array', () => {
		const result = AnyToString([1, ['test'], 3]);
		expect(result).not.toContain('test');
		expect(result).toBe(JSON.stringify([1, '[object Array]', 3]));
	});

	it('uses custom toString in nested object', () => {
		const result = AnyToString([1, {
			toString: () => 'Custom toString string',
		}, 2]);
		expect(result).toBe(JSON.stringify([1, 'Custom toString string', 2]));
	});

	it('formats object with null prototype in nested object', () => {
		const obj = {};
		Object.setPrototypeOf(obj, null);
		const result = AnyToString([1, obj, 2]);
		expect(result).toBe(JSON.stringify([1, '[object null]', 2]));
	});
});
