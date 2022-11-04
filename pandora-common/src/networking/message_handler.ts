import { Logger } from '../logging';
import { SocketInterfaceDefinition, SocketInterfaceHandlerResult, SocketInterfaceOneshotMessages, SocketInterfaceRequest, SocketInterfaceRespondedMessages, SocketInterfaceResponse } from './helpers';

type MessageHandlerFunction<T extends SocketInterfaceDefinition, Context, Message extends keyof T> =
	(arg: SocketInterfaceRequest<T>[Message], context: Context) => SocketInterfaceHandlerResult<T>[Message];

type RespondingHandlers<T extends SocketInterfaceDefinition, Context> = {
	[K in SocketInterfaceRespondedMessages<T>]: MessageHandlerFunction<T, Context, K>;
};

type OneshotHandlers<T extends SocketInterfaceDefinition, Context> = {
	[K in SocketInterfaceOneshotMessages<T>]: MessageHandlerFunction<T, Context, K>;
};

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

export class UnauthorizedError extends BadMessageError {
	constructor(...extra: unknown[]) {
		super(...extra);
		this.name = 'Unauthorized';
	}

	public override log(logger: Logger, messageType: string, message: unknown): void {
		logger.warning(`Unauthorized message content for '${messageType}' `, message, ...this.extra);
	}
}

export interface IMessageHandler<T extends SocketInterfaceDefinition, Context = undefined> {
	/**
	 * Handle incoming message
	 * @param messageType - The type of incoming message
	 * @param message - The message
	 * @param callback - Callback to call for message response
	 * @param context - Context to pass to message handler
	 * @returns Promise of resolution of the message, `true` if resolved, `false` on failure
	 */
	onMessage<K extends keyof T>(
		messageType: K,
		message: SocketInterfaceRequest<T>[K],
		callback: ((arg: SocketInterfaceResponse<T>[K]) => void) | undefined,
		context: Context,
	): Promise<boolean>
}

export class MessageHandler<T extends SocketInterfaceDefinition, Context = undefined> implements IMessageHandler<T, Context> {
	private readonly _responseHandlers: ReadonlyMap<keyof T, MessageHandlerFunction<T, Context, keyof T>>;
	private readonly _oneshotHandlers: ReadonlyMap<keyof T, MessageHandlerFunction<T, Context, keyof T>>;

	constructor(responseHandlers: RespondingHandlers<T, Context>, oneshotHandlers: OneshotHandlers<T, Context>) {
		this._responseHandlers = new Map(Object.entries(responseHandlers));
		this._oneshotHandlers = new Map(Object.entries(oneshotHandlers));
	}

	public async onMessage<K extends keyof T>(
		messageType: K,
		message: SocketInterfaceRequest<T>[K],
		callback: ((arg: SocketInterfaceResponse<T>[K]) => void) | undefined,
		context: Context,
	): Promise<boolean> {
		if (callback) {
			const handler = this._responseHandlers.get(messageType);
			if (!handler) {
				return false;
			}
			callback((await handler(message, context)) as SocketInterfaceResponse<T>[K]);
		} else {
			const handler = this._oneshotHandlers.get(messageType);
			if (!handler) {
				return false;
			}
			await handler(message, context);
		}
		return true;
	}
}
