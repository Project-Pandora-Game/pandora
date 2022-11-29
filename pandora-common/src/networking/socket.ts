export interface Emitter {
	emit(event: string, arg: unknown): void;
}

export interface EmitterWithAck extends Emitter {
	timeout(seconds: number): {
		emit(event: string, arg: unknown, callback: (error: unknown, arg: unknown) => void): void;
	};
	emit(event: string, arg: unknown, callback?: (arg: unknown) => void): void;
}

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
	onMessage: ((messageType: unknown, message: unknown, callback: ((arg: Record<string, unknown>) => void) | undefined) => void) | null;
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
	public onMessage: ((messageType: unknown, message: unknown, callback: ((arg: Record<string, unknown>) => void) | undefined) => void) | null = null;

	public isConnected(): boolean {
		return this.connected;
	}

	public timeout(seconds: number): {
		emit(event: string, arg: unknown, callback: (error: unknown, arg: unknown) => void): void;
	} {
		return ({
			emit: (event: string, arg: unknown, callback: (error: unknown, arg: unknown) => void) => {
				let finished = false;

				/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */
				// eslint-disable-next-line @typescript-eslint/ban-ts-comment
				// @ts-ignore: setTimeout - not sure if Node.js or browser
				const timeout = setTimeout(() => {
					if (finished)
						return;
					finished = true;
					callback(new Error('operation has timed out'), undefined);
				}, seconds);

				this.emit(event, arg, (result) => {
					if (finished)
						return;
					finished = true;
					// eslint-disable-next-line @typescript-eslint/ban-ts-comment
					// @ts-ignore: clearTimeout - not sure if Node.js or browser
					clearTimeout(timeout);
					callback(null, result);
				});
				/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */
			},
		});
	}

	public emit(event: string, arg: unknown, callback?: (arg: unknown) => void): void {
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
