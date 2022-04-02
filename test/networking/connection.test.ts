import { MESSAGE_HANDLER_DEBUG_MESSAGES } from '../../src';
import { GetLogger, LogLevel } from '../../src/logging';
import { Connection, ConnectionBase } from '../../src/networking/connection';

const mockEmit = jest.fn((_event: string, _arg: unknown) => {/**nothing */ });
const mockEmitCB = jest.fn((_event: string, _arg: unknown, _cb?: (arg: unknown) => void) => {/**nothing */ });
const mockEmitTCB = jest.fn((_event: string, _arg: unknown, _cb?: (error: unknown, arg: unknown) => void) => {/**nothing */ });
const mockTimeout = jest.fn((_seconds: number) => ({ emit: mockEmitTCB }));

const mockEmitter = {
	emit: mockEmit,
};

const mockEmitterCB = {
	timeout: mockTimeout,
	emit: mockEmitCB,
};

const mockLogMessage = jest.fn((_level: LogLevel, _message: unknown[]) => {/**nothing */ });
const mockLogger = GetLogger('mock');
mockLogger.logMessage = mockLogMessage;
MESSAGE_HANDLER_DEBUG_MESSAGES.add('debuggedType');

describe('ConnectionBase', () => {
	const mock = new ConnectionBase(mockEmitter, mockLogger);

	describe('sendMessage()', () => {
		beforeEach(() => {
			mockEmit.mockClear();
			mockLogMessage.mockClear();
		});
		it('should emit message with type', () => {
			mock.sendMessage('type' as never, 'message' as never);
			const emit = mockEmit.mock.calls;
			expect(emit.length).toBe(1);
			expect(emit[0][0]).toBe('type');
			expect(emit[0][1]).toBe('message');
		});

		it('should debug messages in debug set', () => {
			mock.sendMessage('debuggedType' as never, 'message' as never);
			const msg = mockLogMessage.mock.calls;
			expect(msg.length).toBe(1);
			expect(msg[0][0]).toBe(LogLevel.DEBUG);
			expect(msg[0][1]).toContain('message');
		});
	});
});

describe('Connection', () => {
	const mock = new Connection(mockEmitterCB, mockLogger);
	describe('awaitResponse()', () => {
		beforeEach(() => {
			jest.clearAllMocks();
		});
		it('should emit message with type', () => {
			void mock.awaitResponse('type' as never, 'message' as never, 1 as never);
			expect(mockEmitTCB.mock.calls.length).toBe(1);
			expect(mockEmitCB.mock.calls.length).toBe(0);
		});
		it('should call timeout', () => {
			void mock.awaitResponse('type' as never, 'message' as never, 1 as never);
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			expect(mockTimeout.mock.calls.length).toBe(1);
		});

		it('should debug messages in debug set', () => {
			void mock.awaitResponse('debuggedType' as never, 'message' as never, 1 as never);
			expect(mockLogMessage.mock.calls.length).toBe(1);
		});
	});
});
