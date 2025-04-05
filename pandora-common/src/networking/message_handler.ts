import type { Logger } from '../logging/logger.ts';
import { SocketInterfaceDefinition, SocketInterfaceHandlerResult, SocketInterfaceMessages, SocketInterfaceRequest, SocketInterfaceResponse } from './helpers.ts';

type MessageHandlerFunction<T extends SocketInterfaceDefinition, Context, Message extends SocketInterfaceMessages<T> = SocketInterfaceMessages<T>> =
	(arg: SocketInterfaceRequest<T>[Message], context: Context) => SocketInterfaceHandlerResult<T>[Message];

export type MessageHandlers<T extends SocketInterfaceDefinition, Context = undefined> = {
	[K in SocketInterfaceMessages<T>]: MessageHandlerFunction<T, Context, K>;
};

export class BadMessageError extends Error {
	protected readonly extra: unknown[];

	constructor(...extra: unknown[]) {
		super();
		this.name = 'BadMessage';
		this.extra = extra;
	}

	public log(logger: Logger, messageType: string, message: unknown): void {
		logger.warning(`Bad message '${messageType}' `, message, ...this.extra);
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
	onMessage<K extends SocketInterfaceMessages<T>>(
		messageType: K,
		message: SocketInterfaceRequest<T>[K],
		context: Context,
	): Promise<SocketInterfaceResponse<T>[K]>;
}

export class MessageHandler<T extends SocketInterfaceDefinition, Context = undefined> implements IMessageHandler<T, Context> {
	private readonly _messageHandlers: ReadonlyMap<SocketInterfaceMessages<T>, MessageHandlerFunction<T, Context>>;

	constructor(handlers: MessageHandlers<T, Context>) {
		this._messageHandlers = new Map(Object.entries(handlers));
	}

	public async onMessage<K extends SocketInterfaceMessages<T>>(
		messageType: K,
		message: SocketInterfaceRequest<T>[K],
		context: Context,
	): Promise<SocketInterfaceResponse<T>[K]> {
		const handler = this._messageHandlers.get(messageType) as (MessageHandlerFunction<T, Context, K> | undefined);
		if (!handler) {
			throw new Error(`Unknown messageType '${messageType}'`);
		}
		return (await handler(message, context)) as SocketInterfaceResponse<T>[K];
	}
}
