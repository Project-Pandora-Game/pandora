/*
In Pandora we use following conventions for sending messages:

Each message is an object and optionally has a callback.

The callback can receive two arguments in specified combination:
- `null` and result of the request, as object
- A string describing error that happened and undefined response
*/

export interface Emitter {
	emit(event: string, data: unknown): void;
}

export interface EmitterWithAck extends Emitter {
	timeout(seconds: number): {
		emit(event: string, data: unknown, callback: (socketError: unknown, error: unknown, response?: unknown) => void): void;
	};
	emit(event: string, data: unknown, callback?: (error: unknown, response?: unknown) => void): void;
}

export type MessageCallback = {
	(error: string): void;
	(error: null, response: Record<string, unknown>): void;
};

export interface IncomingSocket extends EmitterWithAck {
	readonly id: string;
	/** Check if this connection is still connected */
	isConnected(): boolean;

	/** Forcibly closes the connection */
	disconnect(): void;

	/** Handler for when client disconnects */
	onDisconnect: ((reason: string) => void) | null;
	/**
	 * Handle incoming message from client
	 * @param messageType - The type of incoming message
	 * @param message - The message
	 * @returns Promise of resolution of the message, for some messages also response data
	 */
	onMessage: ((messageType: unknown, message: unknown, callback: MessageCallback | undefined) => void) | null;
}

export class MockConnectionSocket implements IncomingSocket {
	public readonly id;
	public readonly remote: MockConnectionSocket;

	constructor(id: string, otherSocket?: MockConnectionSocket) {
		this.id = id;
		if (otherSocket) {
			this.remote = otherSocket;
		} else {
			this.remote = new MockConnectionSocket(id, this);
		}
	}

	public connected: boolean = true;

	public onDisconnect: ((reason: string) => void) | null = null;
	public onMessage: ((messageType: unknown, message: unknown, callback: MessageCallback | undefined) => void) | null = null;

	public isConnected(): boolean {
		return this.connected;
	}

	public timeout(seconds: number): {
		emit(event: string, arg: unknown, callback: (socketError: unknown, error: unknown, arg?: unknown) => void): void;
	} {
		return ({
			emit: (event: string, arg: unknown, callback: (socketError: unknown, error: unknown, arg?: unknown) => void) => {
				let finished = false;

				/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */
				// eslint-disable-next-line @typescript-eslint/ban-ts-comment
				// @ts-ignore: setTimeout - not sure if Node.js or browser
				const timeout = setTimeout(() => {
					if (finished)
						return;
					finished = true;
					callback(new Error('operation has timed out'), undefined, undefined);
				}, seconds);

				this.emit(event, arg, (error, result) => {
					if (finished)
						return;
					finished = true;
					// eslint-disable-next-line @typescript-eslint/ban-ts-comment
					// @ts-ignore: clearTimeout - not sure if Node.js or browser
					clearTimeout(timeout);
					callback(null, error, result);
				});
				/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */
			},
		});
	}

	public emit(event: string, arg: unknown, callback?: (error: unknown, arg?: unknown) => void): void {
		this.remote.onMessage?.(event, arg, callback);
	}

	public disconnect(): void {
		if (!this.connected)
			return;
		this.connected = false;
		this.remote.connected = false;
		this.remote.onDisconnect?.('connection closed');
		this.onDisconnect?.('connection closed');
	}
}
