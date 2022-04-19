import { SocketInterfaceResponseHandler, SocketInterfaceOneshotHandler } from './helpers';
import { Logger } from '../logging';
import type { Equals } from '../utility';
import { IsObject } from '../validation';
import { MESSAGE_HANDLER_DEBUG_ALL, MESSAGE_HANDLER_DEBUG_MESSAGES } from './config';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ResponseHandler<Context> = true extends Equals<Context, void> ? (arg: any) => Record<string, unknown> | Promise<Record<string, unknown>> : (arg: any, context: Context) => Record<string, unknown> | Promise<Record<string, unknown>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OneshotHandler<Context> = true extends Equals<Context, void> ? (arg: any) => void | Promise<void> : (arg: any, context: Context) => void | Promise<void>;

type AddContext<T, Context> = {
	[K in keyof T]: true extends Equals<Context, void> ? T[K] : T[K] extends (arg: infer A) => infer R ? (arg: A, context: Context) => R : never;
};

export class BadMessageError extends Error {
	private readonly _extra: unknown[];

	constructor(...extra: unknown[]) {
		super();
		this.name = 'BadMessage';
		this._extra = extra;
	}

	public log(logger: Logger, messageType: string, message: unknown): void {
		logger.warning(`Bad message content for '${messageType}' `, message, ...this._extra);
	}
}

export interface IMessageHandler<Context = void> {
	onMessage(messageType: string, message: Record<string, unknown>, callback?: (arg: Record<string, unknown>) => void, ...[context]: true extends Equals<Context, void> ? [] : [Context]): Promise<boolean>;
}

export class MessageHandler<T, Context = void> implements IMessageHandler<Context> {
	private readonly _responseHandlers: ReadonlyMap<string, ResponseHandler<Context>>;
	private readonly _oneshotHandlers: ReadonlyMap<string, OneshotHandler<Context>>;

	constructor(responseHandlers: AddContext<SocketInterfaceResponseHandler<T>, Context>, oneshotHandlers: AddContext<SocketInterfaceOneshotHandler<T>, Context>) {
		this._responseHandlers = new Map(Object.entries(responseHandlers));
		this._oneshotHandlers = new Map(Object.entries(oneshotHandlers));
	}

	public async onMessage(messageType: string, message: Record<string, unknown>, callback?: (arg: Record<string, unknown>) => void, ...[context]: true extends Equals<Context, void> ? [] : [Context]): Promise<boolean> {
		if (callback) {
			const handler = this._responseHandlers.get(messageType);
			if (!handler) {
				return false;
			}
			callback(await handler(message, context as Context));
		} else {
			const handler = this._oneshotHandlers.get(messageType);
			if (!handler) {
				return false;
			}
			await handler(message, context as Context);
		}
		return true;
	}
}

export function CreateMessageHandlerOnAny(
	logger: Logger,
	handler: (messageType: string, message: Record<string, unknown>, callback?: (arg: Record<string, unknown>) => void) => Promise<boolean>,
): (messageType: unknown, message: unknown, callback: ((arg: Record<string, unknown>) => void) | undefined) => void {
	return (messageType: unknown, message: unknown, callback: ((arg: Record<string, unknown>) => void) | undefined) => {
		if (typeof messageType !== 'string') {
			logger.error(`Invalid messageType: ${typeof messageType}`);
			return;
		}
		if (!IsObject(message)) {
			logger.error(`Message '${messageType}' is not an object`);
			return;
		}
		if (callback !== undefined && typeof callback !== 'function') {
			logger.error(`Message '${messageType}' callback is not a function: ${typeof callback}`);
			return;
		}
		if (MESSAGE_HANDLER_DEBUG_ALL || MESSAGE_HANDLER_DEBUG_MESSAGES.has(messageType)) {
			logger.debug(`\u25BC message '${messageType}'${callback ? ' with callback' : ''}`, message);
			if (callback) {
				const outerCallback = callback;
				callback = (result: Record<string, unknown>) => {
					logger.debug(`\u25B2 message '${messageType}' result:`, result);
					outerCallback(result);
				};
			}
		}
		handler(messageType, message, callback)
			.then((success) => {
				if (!success) {
					logger.error(`Message '${messageType}' has no handler`);
				}
			})
			.catch((error) => {
				if (error === false)
					return;

				if (error instanceof BadMessageError) {
					error.log(logger, messageType, message);
				} else {
					logger.error('Error processing message:', error, `\nMessage type: '${messageType}', message:`, message);
				}
			});
	};
}
