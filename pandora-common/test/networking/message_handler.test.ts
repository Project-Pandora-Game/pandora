import { z } from 'zod';
import { Satisfies } from '../../src/index.ts';
import { SocketInterfaceDefinition, SocketInterfaceHandlerResult, SocketInterfaceRequest } from '../../src/networking/helpers.ts';
import { MessageHandler } from '../../src/networking/message_handler.ts';

export const TestSchema = {
	message1: {
		request: z.object({
			test: z.number(),
		}),
		response: z.object({
			test: z.number(),
		}),
	},
	message2: {
		request: z.object({
			test: z.number(),
		}),
		response: z.object({
			test: z.number(),
		}),
	},
	oneshot1: {
		request: z.object({
			test: z.number(),
		}),
		response: null,
	},
	oneshot2: {
		request: z.object({
			test: z.number(),
		}),
		response: null,
	},
} as const;

type TestInterface = Satisfies<typeof TestSchema, SocketInterfaceDefinition>;
type TestInterfaceArgument = SocketInterfaceRequest<TestInterface>;
type TestInterfaceResult = SocketInterfaceHandlerResult<TestInterface>;

const testMessage = { test: 1 };

describe('MessageHandler', () => {
	const handleMessage1 = jest.fn(({ test }: TestInterfaceArgument['message1']): TestInterfaceResult['message1'] => {
		return { test: test + 1 };
	});
	const handleMessage2 = jest.fn(({ test }: TestInterfaceArgument['message2']): TestInterfaceResult['message2'] => {
		return Promise.resolve({ test: test + 2 });
	});
	const handleOneshot1 = jest.fn((_arg: TestInterfaceArgument['oneshot1']): TestInterfaceResult['oneshot1'] => {
		return;
	});
	const handleOneshot2 = jest.fn((_arg: TestInterfaceArgument['oneshot2']): TestInterfaceResult['oneshot2'] => {
		return Promise.resolve();
	});
	const handler = new MessageHandler<TestInterface>({
		message1: handleMessage1,
		message2: handleMessage2,
		oneshot1: handleOneshot1,
		oneshot2: handleOneshot2,
	});

	function onMessage(messageType: string, message: Record<string, unknown>): Promise<Record<string, unknown> | undefined> {
		// @ts-expect-error: Intentionally bypassing type to test invalid messages getting through
		return handler.onMessage(messageType, message, undefined);
	}

	describe('onMessage()', () => {
		it('should be able to call all interface-declared oneshot-handlers', async () => {
			await expect(onMessage('oneshot1', testMessage)).resolves.not.toThrow();
			expect(handleOneshot1.mock.calls.length).toBe(1);
			await expect(onMessage('oneshot2', testMessage)).resolves.not.toThrow();
			expect(handleOneshot2.mock.calls.length).toBe(1);
		});

		it('should be able to call all interface-declared response-handlers', async () => {
			await expect(onMessage('message1', testMessage)).resolves.not.toThrow();
			expect(handleMessage1.mock.calls.length).toBe(1);
			await expect(onMessage('message2', testMessage)).resolves.not.toThrow();
			expect(handleMessage2.mock.calls.length).toBe(1);

		});

		it('should not call when non-interface-declared message type is passed', async () => {
			await expect(onMessage('whoknows1', testMessage)).rejects.toThrow();
			await expect(onMessage('whoknows2', testMessage)).rejects.toThrow();
			expect(handleOneshot1.mock.calls.length).toBe(0);
			expect(handleOneshot2.mock.calls.length).toBe(0);
			expect(handleMessage1.mock.calls.length).toBe(0);
			expect(handleMessage2.mock.calls.length).toBe(0);
		});

		it('should pass the correct message to the right handler', async () => {
			await onMessage('message1', { test: 10 });
			expect(handleMessage1.mock.calls[0][0]).toEqual({ test: 10 });
			await onMessage('message2', { test: 100 });
			expect(handleMessage2.mock.calls[0][0]).toEqual({ test: 100 });

			await onMessage('oneshot1', { test: 1000 });
			expect(handleOneshot1.mock.calls[0][0]).toEqual({ test: 1000 });
			await onMessage('oneshot2', { test: 5 });
			expect(handleOneshot2.mock.calls[0][0]).toEqual({ test: 5 });
		});

		it('should return object for response-handlers', async () => {
			await expect(onMessage('message1', testMessage)).resolves.toMatchObject({});
			await expect(onMessage('message2', testMessage)).resolves.toMatchObject({});
		});

		it('should return the correct value into', async () => {
			await expect(onMessage('message1', testMessage)).resolves.toEqual({ test: 2 });
			await expect(onMessage('message2', testMessage)).resolves.toEqual({ test: 3 });
		});

		it('should return undefined for oneshot-handlers', async () => {
			await expect(onMessage('oneshot1', testMessage)).resolves.toBeUndefined();
			await expect(onMessage('oneshot2', testMessage)).resolves.toBeUndefined();
		});
	});
});
