import type { Server as HttpServer, IncomingMessage } from 'http';
import type { IEmpty } from 'pandora-common';
import { Server, Socket, ServerOptions as SocketIoOptions, type DefaultEventsMap } from 'socket.io';

/** Class housing any socket.io endpoint */
export abstract class SocketIOServer<SocketData extends object = IEmpty> {
	/** Socket.IO server */
	protected readonly socketServer: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, Partial<SocketData>>;

	/** HTTP(S) server */
	protected readonly httpServer: HttpServer;

	protected constructor(httpServer: HttpServer, socketIoSettings: Partial<SocketIoOptions>) {
		this.httpServer = httpServer;
		this.socketServer = new Server(httpServer, {
			...socketIoSettings,
			cors: {
				origin: /./,
				credentials: true,
			},
			serveClient: false,
			allowRequest: this.allowRequest.bind(this),
		});
		this.socketServer.on('connect', this.onConnect.bind(this));
	}

	/**
	 * Check incoming request and decide if it should be accepted or not
	 * @param req - The request to check
	 * @param next - Callback for accept/reject
	 */
	protected allowRequest(_req: IncomingMessage, next: (err: string | null | undefined, success: boolean) => void): void {
		// Default is to allow everything
		next(undefined, true);
	}

	/**
	 * Handle new incoming connections
	 * @param socket - The newly connected socket
	 */
	protected abstract onConnect(socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, Partial<SocketData>>): void;
}
