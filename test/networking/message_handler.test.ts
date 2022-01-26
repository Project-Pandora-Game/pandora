import { RecordOnly, SocketInterfaceArgs, SocketInterfaceResult } from '../../src/networking/helpers';
import { MessageHandler } from '../../src/networking/message_handler';

interface TestInterface {
	message1({ test }: { test: number; }): { test: number; };
	message2({ test }: { test: number; }): { test: number; };
	oneshot1(_arg: { test: number; }): void;
	oneshot2(_arg: { test: number; }): void;
}

type TestArgument = RecordOnly<SocketInterfaceArgs<TestInterface>>;
type TestResult = SocketInterfaceResult<TestInterface>;

const testMessage = { test: 1 };

describe('MessageHandler', () => {
	const mockCallback = jest.fn<unknown, Record<string, unknown>[]>();
	const handleMessage1 = jest.fn(({ test }: TestArgument['message1']): TestResult['message1'] => {
		return { test: test + 1 };
	});
	const handleMessage2 = jest.fn(({ test }: TestArgument['message2']): TestResult['message2'] => {
		return Promise.resolve({ test: test + 2 });
	});
	const handleOneshot1 = jest.fn((_arg: TestArgument['oneshot1']): TestResult['oneshot1'] => {
		return;
	});
	const handleOneshot2 = jest.fn((_arg: TestArgument['oneshot2']): TestResult['oneshot2'] => {
		return Promise.resolve();
	});
	const handler = new MessageHandler<TestInterface>({
		message1: handleMessage1,
		message2: handleMessage2,
	}, {
		oneshot1: handleOneshot1,
		oneshot2: handleOneshot2,
	});

	function onMessage(messageType: string, message: Record<string, unknown>, callback?: (arg: Record<string, unknown>) => void): Promise<boolean> {
		return handler.onMessage(messageType, message, callback);
	}

	describe('onMessage()', () => {
		afterEach(() => mockCallback.mockClear());

		it('should be able to call all interface-declared oneshot-handlers', async () => {
			expect(await onMessage('oneshot1', testMessage)).toBeTruthy();
			expect(handleOneshot1.mock.calls.length).toBe(1);
			expect(await onMessage('oneshot2', testMessage)).toBeTruthy();
			expect(handleOneshot2.mock.calls.length).toBe(1);
		});

		it('should be able to call all interface-declared response-handlers', async () => {
			expect(await onMessage('message1', testMessage, mockCallback)).toBeTruthy();
			expect(handleMessage1.mock.calls.length).toBe(1);
			expect(await onMessage('message2', testMessage, mockCallback)).toBeTruthy();
			expect(handleMessage2.mock.calls.length).toBe(1);

		});

		it('should not call when non-interface-declared message type is passed', async () => {
			expect(await onMessage('whoknows1', testMessage)).toBeFalsy();
			expect(await onMessage('whoknows2', testMessage, mockCallback)).toBeFalsy();
			expect(handleOneshot1.mock.calls.length).toBe(0);
			expect(handleOneshot2.mock.calls.length).toBe(0);
			expect(handleMessage1.mock.calls.length).toBe(0);
			expect(handleMessage2.mock.calls.length).toBe(0);
			expect(mockCallback.mock.calls.length).toBe(0);
		});

		it('should prevent mixup between response-handler type and oneshot-handler type', async () => {
			expect(await onMessage('message1', testMessage)).toBeFalsy();
			expect(await onMessage('oneshot1', testMessage, mockCallback)).toBeFalsy();
		});

		it('should pass the correct message to the right handler', async () => {
			await onMessage('message1', { test: 10 }, mockCallback);
			expect(handleMessage1.mock.calls[0][0]).toEqual({ test: 10 });
			await onMessage('message2', { test: 100 }, mockCallback);
			expect(handleMessage2.mock.calls[0][0]).toEqual({ test: 100 });

			await onMessage('oneshot1', { test: 1000 });
			expect(handleOneshot1.mock.calls[0][0]).toEqual({ test: 1000 });
			await onMessage('oneshot2', { test: 5 });
			expect(handleOneshot2.mock.calls[0][0]).toEqual({ test: 5 });
		});

		it('should call callBacks for response-handlers', async () => {
			await onMessage('message1', testMessage, mockCallback);
			expect(mockCallback.mock.calls.length).toBe(1);
			await onMessage('message2', testMessage, mockCallback);
			expect(mockCallback.mock.calls.length).toBe(2);
		});

		it('should pass the correct handler return value into the right callBack', async () => {
			await onMessage('message1', testMessage, mockCallback);
			expect(mockCallback.mock.calls[0][0]).toEqual({ test: 2 });
			await onMessage('message2', testMessage, mockCallback);
			expect(mockCallback.mock.calls[1][0]).toEqual({ test: 3 });
		});

		it('should not call callBacks for oneshot-handlers', async () => {
			await onMessage('oneshot1', testMessage, mockCallback);
			expect(mockCallback.mock.calls.length).toBe(0);
			await onMessage('oneshot2', testMessage, mockCallback);
			expect(mockCallback.mock.calls.length).toBe(0);
		});
	});
});
