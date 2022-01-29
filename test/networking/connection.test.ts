import { GetLogger, LogLevel } from '../../src/logging';
import { Connection, ConnectionBase } from '../../src/networking/connection';

const mockEmit = jest.fn((_event: string, _arg: unknown) => {/**nothing */ });
const mockEmitCB = jest.fn((_event: string, _arg: unknown, _cb: (r: unknown) => void) => {/**nothing */ });
const mockTimeout = jest.fn((_seconds: number) => {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-return
	return mockEmitterCB;
});

const mockEmitter = {
	emit: mockEmit,
};

const mockEmitterCB = {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	timeout: mockTimeout,
	emit: mockEmitCB,
};
const mockLogMessage = jest.fn((_level: LogLevel, _message: unknown[]) => {/**nothing */ });
const mockLogger = GetLogger('mock');
mockLogger.logMessage = mockLogMessage;

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

		it('should debug each message', () => {
			mock.sendMessage('type' as never, 'message' as never);
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
			expect(mockEmitCB.mock.calls.length).toBe(1);
		});
		it('should call timeout', () => {
			void mock.awaitResponse('type' as never, 'message' as never, 1 as never);
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			expect(mockTimeout.mock.calls.length).toBe(1);
		});

		it('should debug each message', () => {
			void mock.awaitResponse('type' as never, 'message' as never, 1 as never);
			expect(mockLogMessage.mock.calls.length).toBe(1);
		});
	});
});
