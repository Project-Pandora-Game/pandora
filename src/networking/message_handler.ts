import { SocketInterfaceResponseHandler, SocketInterfaceOneshotHandler } from './helpers';
import type { Equals } from '../utility';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ResponseHandler<Context> = true extends Equals<Context, void> ? (arg: any) => Record<string, unknown> | Promise<Record<string, unknown>> : (arg: any, context: Context) => Record<string, unknown> | Promise<Record<string, unknown>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OneshotHandler<Context> = true extends Equals<Context, void> ? (arg: any) => void | Promise<void> : (arg: any, context: Context) => void | Promise<void>;

type AddContext<T, Context> = {
	[K in keyof T]: true extends Equals<Context, void> ? T[K] : T[K] extends (arg: infer A) => infer R ? (arg: A, context: Context) => R : never;
};

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
