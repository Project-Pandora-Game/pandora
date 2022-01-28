import type { Equals } from '../utility';

/** Transform all member function so they may return a promise */
type Promisify<T> = {
	[K in keyof T]: T[K] extends (args: infer A) => infer R ? (args: A) => R | Promise<R> : never;
};

/**

Define a SocketInterface for type 'TestIntenal' as 'Test':

export type Test = SocketInterface<TestIntenal>;
export type TestArgument = RecordOnly<SocketInterfaceArgs<TestIntenal>>;
export type TestUnconfirmedArgument = SocketInterfaceUnconfirmedArgs<TestIntenal>;
export type TestResult = SocketInterfaceResult<TestIntenal>;
export type TestPromiseResult = SocketInterfacePromiseResult<TestIntenal>;
export type TestNormalResult = SocketInterfaceNormalResult<TestIntenal>;
export type TestResponseHandler = SocketInterfaceResponseHandler<TestIntenal>;
export type TestOneshotHandler = SocketInterfaceOneshotHandler<TestIntenal>;
export type TestMessageHandler<Context> = MessageHandler<TestIntenal, Context>;
export type TestBase = TestIntenal; // required for new MessageHandler<TestBase>

 */

/** */
export type SocketInterfaceDefinition<T extends {
	[K in keyof T]: (args: Record<string, unknown>) => void | Record<string, unknown>
}> =
	{
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		[K in keyof T]: true extends Equals<void, ReturnType<T[K]>> ? ((arg: any) => void) : ((arg: any) => Record<string, any>);
	};

/** Defines the arguments for a SocketInterface */
export type SocketInterfaceArgs<T extends Record<keyof T, unknown>> =
	{
		[K in keyof T]: T[K] extends ((arg: infer U) => unknown) ? U : never;
	};

/** Defines the unconfiremed arguments for a SocketInterface */
export type SocketInterfaceUnconfirmedArgs<T extends Record<keyof T, unknown>> = {
	[K in keyof T]: Record<string, unknown>;
};

/**
 * Defines the results of a SocketInterface
 *
 * must be used as RecordOnly<SocketInterfaceResult<MyType>>
 */
export type SocketInterfaceResult<T extends SocketInterfaceDefinition<T>> =
	{
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		[K in keyof T]: T[K] extends (arg: any) => Record<string, any> ? (T[K] extends (arg: any) => infer R ? R | Promise<R> : never) : (T[K] extends (arg: any) => void ? (void | Promise<void>) : never);
	};

export type SocketInterfacePromiseResult<T extends Record<keyof T, unknown>> =
	{
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		[K in keyof T]: T[K] extends (arg: any) => Record<string, any> ? (T[K] extends (arg: any) => infer R ? Promise<R> : never) : (T[K] extends (arg: any) => void ? Promise<void> : never);
	};

export type SocketInterfaceNormalResult<T extends Record<keyof T, unknown>> =
	{
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		[K in keyof T]: T[K] extends (arg: any) => Record<string, any> ? (T[K] extends (arg: any) => infer R ? R : never) : (T[K] extends (arg: any) => void ? void : never);
	};

/** Filters SocketInterface for response handlers */
export type SocketInterfaceResponseHandler<T extends Record<keyof T, unknown>> = Pick<Promisify<T>, {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	[K in keyof T]: T[K] extends (arg: any) => Record<string, any> ? K : never;
}[keyof T]>;

/** Filters SocketInterface for oneshot handlers */
export type SocketInterfaceOneshotHandler<T extends Record<keyof T, unknown>> = Pick<Promisify<T>, {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	[K in keyof T]: T[K] extends (arg: any) => Record<string, any> ? never : K;
}[keyof T]>;

/** Defines SocketInterface for type T */
export type SocketInterface<T extends Record<keyof T, unknown>> = {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	[K in keyof T]: T[K] extends (arg: infer A) => infer R ? (arg: A) => R | Promise<R> : never;
};

/** Only accept records with string keys as members */
export type RecordOnly<T extends {
	[K in keyof T]: Record<string, unknown>;
}> = T;
