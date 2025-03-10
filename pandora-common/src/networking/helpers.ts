import { z, ZodType, ZodTypeDef } from 'zod';
import type { KeysMatching, Awaitable } from '../utility/misc.ts';

/** The base type for how (one-way) socket interface definition should look like */
export type SocketInterfaceDefinition = {
	[messageType: string]: {
		/** The body of request of this message, must be an object */
		request: ZodType<Record<never, unknown>>;
		/** The body of response for this message, must be an object or `null` if this is one-shot message */
		response: ZodType<Record<never, unknown>> | null;
	};
};

/** The base type for how socket interface definition looks like, also verifying all requests and responses are objects */
export type SocketInterfaceDefinitionVerified<T extends SocketInterfaceDefinition> = {
	[messageType in keyof T]: {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		request: ZodType<RecordOnlyElement<z.infer<T[messageType]['request']>>, ZodTypeDef, any>;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		response: T[messageType]['response'] extends ZodType<Record<never, unknown>, ZodTypeDef, any> ? ZodType<RecordOnlyElement<z.infer<T[messageType]['response']>>, ZodTypeDef, any> : null;
	};
};

/** Defines the arguments for a SocketInterface request */
export type SocketInterfaceRequest<T extends SocketInterfaceDefinition> = {
	[K in keyof T]: z.infer<T[K]['request']>;
};

/** Defines the SocketInterface response (raw/awaited) */
export type SocketInterfaceResponse<T extends SocketInterfaceDefinition> = {
	[K in keyof T]: T[K]['response'] extends ZodType<Record<never, unknown>> ? z.infer<T[K]['response']> : void;
};

/** Defines the SocketInterface response (possibly wrapped in promise) */
export type SocketInterfaceHandlerResult<T extends SocketInterfaceDefinition> = {
	[K in keyof T]: Awaitable<SocketInterfaceResponse<T>[K]>;
};

/** Defines the SocketInterface response (promise - for async function) */
export type SocketInterfaceHandlerPromiseResult<T extends SocketInterfaceDefinition> = {
	[K in keyof T]: Promise<SocketInterfaceResponse<T>[K]>;
};

/** Lists all messageTypes */
export type SocketInterfaceMessages<T extends SocketInterfaceDefinition> = keyof T & string;
/** Lists all messageTypes that are oneshot (have no response) */
export type SocketInterfaceOneshotMessages<T extends SocketInterfaceDefinition> = KeysMatching<SocketInterfaceResponse<T>, void> & string;
/** Lists all messageTypes that have response */
export type SocketInterfaceRespondedMessages<T extends SocketInterfaceDefinition> = KeysMatching<SocketInterfaceResponse<T>, Record<never, unknown>> & string;

type RecordOnlyElement<T> =
	T extends symbol ? never :
	T extends boolean ? never :
	T extends number ? never :
	T extends string ? never :
	T extends unknown[] ? never :
	T extends (...args: unknown[]) => unknown ? never :
	T extends object ? T :
	never;
