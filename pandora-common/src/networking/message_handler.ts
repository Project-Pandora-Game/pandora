import { Logger } from '../logging';
import type { Equals } from '../utility';
import { SocketInterfaceDefinition, SocketInterfaceHandlerResult, SocketInterfaceOneshotMessages, SocketInterfaceRequest, SocketInterfaceRespondedMessages } from './helpers';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ResponseHandler<Context> = true extends Equals<Context, void> ? (arg: any) => Record<string, unknown> | Promise<Record<string, unknown>> : (arg: any, context: Context) => Record<string, unknown> | Promise<Record<string, unknown>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OneshotHandler<Context> = true extends Equals<Context, void> ? (arg: any) => void | Promise<void> : (arg: any, context: Context) => void | Promise<void>;

type AddContext<T, Context> = {
	[K in keyof T]: true extends Equals<Context, void> ? T[K] : T[K] extends (arg: infer A) => infer R ? (arg: A, context: Context) => R : never;
};

type RespondingHandlers<T extends SocketInterfaceDefinition, Context> = AddContext<{
	[K in SocketInterfaceRespondedMessages<T>]: (arg: SocketInterfaceRequest<T>[K]) => SocketInterfaceHandlerResult<T>[K];
}, Context>;

type OneshotHandlers<T extends SocketInterfaceDefinition, Context> = AddContext<{
	[K in SocketInterfaceOneshotMessages<T>]: (arg: SocketInterfaceRequest<T>[K]) => SocketInterfaceHandlerResult<T>[K];
}, Context>;

export class BadMessageError extends Error {
	protected readonly extra: unknown[];

	constructor(...extra: unknown[]) {
		super();
		this.name = 'BadMessage';
		this.extra = extra;
	}

	public log(logger: Logger, messageType: string, message: unknown): void {
		logger.warning(`Bad message content for '${messageType}' `, message, ...this.extra);
	}
}

export class UnauthoriedError extends BadMessageError {
	constructor(...extra: unknown[]) {
		super(...extra);
		this.name = 'Unauthorized';
	}

	public override log(logger: Logger, messageType: string, message: unknown): void {
		logger.warning(`Unauthorized message content for '${messageType}' `, message, ...this.extra);
	}
}

export interface IMessageHandler<Context = void> {
	onMessage(messageType: string, message: Record<string, unknown>, callback?: (arg: Record<string, unknown>) => void, ...[context]: true extends Equals<Context, void> ? [] : [Context]): Promise<boolean>;
}

export class MessageHandler<T extends SocketInterfaceDefinition, Context = void> implements IMessageHandler<Context> {
	private readonly _responseHandlers: ReadonlyMap<string, ResponseHandler<Context>>;
	private readonly _oneshotHandlers: ReadonlyMap<string, OneshotHandler<Context>>;

	constructor(responseHandlers: RespondingHandlers<T, Context>, oneshotHandlers: OneshotHandlers<T, Context>) {
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
