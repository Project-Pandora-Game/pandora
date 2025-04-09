import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { EmitterWithAck, IEmpty, MESSAGE_HANDLER_DEBUG_MESSAGES } from '../../src/index.ts';
import { GetLogger, LogLevel } from '../../src/logging/index.ts';
import { ConnectionBase } from '../../src/networking/connection.ts';

const mockEmitCB = jest.fn((_event: string, _arg: unknown, _cb?: (arg: unknown) => void) => {/**nothing */ });
const mockEmitTCB = jest.fn((_event: string, _arg: unknown, _cb?: (error: unknown, arg: unknown) => void) => {/**nothing */ });
const mockTimeout = jest.fn((_seconds: number) => ({ emit: mockEmitTCB }));

const mockEmitter: EmitterWithAck = {
	emit: mockEmitCB,
	timeout: mockTimeout,
};

const mockLogMessage = jest.fn((_level: LogLevel, _message: unknown[]) => {/**nothing */ });
const mockLogger = GetLogger('mock');
mockLogger.logMessage = mockLogMessage;
MESSAGE_HANDLER_DEBUG_MESSAGES.add('debuggedType');

class MockConnectionBase extends ConnectionBase<IEmpty, IEmpty, EmitterWithAck> {
	protected onMessage(): Promise<never> {
		throw new Error('Method not implemented.');
	}
}

describe('ConnectionBase', () => {
	const mock = new MockConnectionBase(mockEmitter, 'DO_NOT_VALIDATE_DATA', mockLogger);

	describe('sendMessage()', () => {
		it('should emit message with type', () => {
			mock.sendMessage('type' as never, 'message' as never);
			const emit = mockEmitCB.mock.calls;
			expect(emit.length).toBe(1);
			expect(emit[0][0]).toBe('type');
			expect(emit[0][1]).toBe('message');
			expect(emit[0][2]).toBe(undefined);
		});

		it('should debug messages in debug set', () => {
			mock.sendMessage('debuggedType' as never, 'message' as never);
			const msg = mockLogMessage.mock.calls;
			expect(msg.length).toBe(1);
			expect(msg[0][0]).toBe(LogLevel.DEBUG);
			expect(msg[0][1]).toContain('message');
		});
	});

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
			expect(mockTimeout.mock.calls.length).toBe(1);
		});

		it('should debug messages in debug set', () => {
			void mock.awaitResponse('debuggedType' as never, 'message' as never, 1 as never);
			expect(mockLogMessage.mock.calls.length).toBe(1);
		});
	});
});
