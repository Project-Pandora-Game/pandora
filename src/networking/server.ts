import { CharacterConnection } from './characterConnection';
import { GetLogger, logConfig } from '../logging';
import { SERVER_HTTPS_CERT, SERVER_HTTPS_KEY, SERVER_PORT } from '../config';
import { Server as HttpServer } from 'http';
import { Server as HttpsServer } from 'https';
import { Server, Socket } from 'socket.io';
import * as fs from 'fs';

const logger = GetLogger('Server');

export class SocketIOServer {
	/** List of all currently connected connections */
	private connectedConnections: Set<CharacterConnection> = new Set();

	/** Socket.IO server */
	private readonly socketServer: Server;

	/** HTTP(S) server */
	private readonly httpServer: HttpServer;

	constructor(httpServer: HttpServer) {
		this.httpServer = httpServer;
		this.socketServer = new Server(httpServer, {
			cors: {
				origin: /./,
			},
			serveClient: false,
		});
		this.socketServer.on('connect', this.onConnect.bind(this));
	}

	/**
	 * Handle new incoming connections
	 * @param socket - The newly connected socket
	 */
	private onConnect(socket: Socket): void {
		logger.debug(`New character connected; id: ${socket.id}`);
		const connection = new CharacterConnection(socket);
		if (!connection.isConnected()) {
			logger.fatal('Asserting failed: client disconnect before onConnect finished');
			return;
		}
		this.connectedConnections.add(connection);
		socket.once('disconnect', () => {
			this.connectedConnections.delete(connection);
			logger.debug(`Character disconnected; id: ${socket.id}`);
		});
	}
}

/** Setup HTTP server and everything related to it */
export function StartHttpServer(): Promise<SocketIOServer> {
	const port = Number.parseInt(SERVER_PORT);
	if (!Number.isInteger(port)) {
		throw new Error('Invalid SERVER_PORT');
	}

	// Setup HTTP(S) server
	let server: HttpServer;
	if (SERVER_HTTPS_CERT || SERVER_HTTPS_KEY) {
		// Read cert+key files in case of HTTPS
		if (!SERVER_HTTPS_CERT || !SERVER_HTTPS_KEY) {
			throw new Error('Only one of SERVER_HTTPS_CERT and SERVER_HTTPS_KEY supplied');
		}
		let certData: string;
		try {
			certData = fs.readFileSync(SERVER_HTTPS_CERT, { encoding: 'utf-8' });
		} catch (e) {
			throw new Error('Failed to read SERVER_HTTPS_CERT file');
		}
		let keyData: string;
		try {
			keyData = fs.readFileSync(SERVER_HTTPS_KEY, { encoding: 'utf-8' });
		} catch (e) {
			throw new Error('Failed to read SERVER_HTTPS_KEY file');
		}
		server = new HttpsServer({
			cert: certData,
			key: keyData,
		});
	} else {
		logger.warning('Starting in HTTP-only mode');
		server = new HttpServer();
	}
	// Attach socket.io server
	const socketServer = new SocketIOServer(server);
	// Start listening
	return new Promise((resolve, reject) => {
		// Catch error during port open
		server.once('error', reject);
		server.listen(port, () => {
			// Port open didn't error
			server.off('error', reject);
			// Setup error logging
			server.on('error', (error) => {
				logger.error('HTTP server Error:', error);
			});
			// Setup shutdown handlers
			logConfig.onFatal.push(() => {
				logger.info('Stopping HTTP server');
				server.close((err) => {
					if (err) {
						logger.error('Failed to close HTTP server', err);
					} else {
						logger.info('HTTP server closed');
					}
				});
			});
			// Finalize start
			logger.info(`HTTP server started on port ${port}`);
			resolve(socketServer);
		});
	});
}
