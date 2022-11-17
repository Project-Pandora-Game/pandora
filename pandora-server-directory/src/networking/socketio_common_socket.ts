import { IncomingSocket } from 'pandora-common';
import type { Socket } from 'socket.io';

export class SocketIOSocket implements IncomingSocket {
	private readonly socket: Socket;

	constructor(socket: Socket) {
		this.socket = socket;
		this.socket.on('disconnect', (reason) => {
			this.onDisconnect?.(reason);
		});
		this.socket.onAny((messageType, message, callback) => {
			this.onMessage?.(messageType, message, callback);
		});
	}

	public onDisconnect: ((reason: string) => void) | null = null;
	public onMessage: ((messageType: unknown, message: unknown, callback: unknown) => void) | null = null;

	public get id(): string {
		return this.socket.id;
	}

	public isConnected(): boolean {
		return this.socket.connected;
	}

	public timeout(timeout: number): {
		emit(event: string, arg: unknown, callback: (error: unknown, arg: unknown) => void): void;
	} {
		return this.socket.timeout(timeout);
	}

	public emit(event: string, arg: unknown, callback?: (arg: unknown) => void): void {
		if (callback) {
			this.socket.emit(event, arg, callback);
		} else {
			this.socket.emit(event, arg);
		}
	}

	public disconnect(): void {
		this.socket.disconnect(true);
	}
}
