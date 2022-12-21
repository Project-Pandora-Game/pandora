import { GetLogger, logConfig, Service } from 'pandora-common';
import { ASSETS_SOURCE, SERVER_HTTPS_CERT, SERVER_HTTPS_KEY, SERVER_PORT, TRUSTED_REVERSE_PROXY_HOPS } from '../config';
import { Server as Node_HttpServer } from 'http';
import { Server as Node_HttpsServer } from 'https';
import { Socket } from 'net';
import * as fs from 'fs';
import { SocketIOServerClient } from './socketio_client_server';
import express from 'express';
import { AssetsServe } from '../assets/assetManager';
import { MetricsServe } from '../metrics';

const logger = GetLogger('Server');

export const HttpServer = new class HttpServer implements Service {
	private _server!: Node_HttpServer;
	private readonly _activeConnections = new Set<Socket>();

	/** Setup HTTP server and everything related to it */
	public init(): Promise<void> {
		const port = Number.parseInt(SERVER_PORT);
		if (!Number.isInteger(port)) {
			throw new Error('Invalid SERVER_PORT');
		}

		// Setup Express application
		const expressApp = express()
			.disable('x-powered-by');

		expressApp.use(function (req, res, next) {
			res.header('Access-Control-Allow-Origin', req.get('Origin') || '*');
			res.header('Access-Control-Allow-Credentials', 'true');
			res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE');
			res.header('Access-Control-Expose-Headers', 'Content-Length');
			res.header('Access-Control-Allow-Headers', 'Accept, Authorization, Content-Type, X-Requested-With, Range');
			if (req.method === 'OPTIONS') {
				return res.send(200);
			} else {
				return next();
			}
		});

		// Setup HTTP(S) server
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
			this._server = new Node_HttpsServer({
				cert: certData,
				key: keyData,
			}, expressApp);
		} else {
			// Warn only if we are not behind proxy that handles HTTPS for us
			if (TRUSTED_REVERSE_PROXY_HOPS === 0) {
				logger.warning('Starting in HTTP-only mode');
			}
			this._server = new Node_HttpServer(expressApp);
		}
		// Host assets (only if we are supposed to)
		if (!ASSETS_SOURCE) {
			expressApp.use('/assets', AssetsServe());
		}
		// Host metrics
		expressApp.use('/metrics', MetricsServe());
		// Attach socket.io server
		new SocketIOServerClient(this._server);
		// Keep track of existing connection
		this._server.on('connection', (socket) => {
			this._activeConnections.add(socket);
			socket.once('close', () => {
				this._activeConnections.delete(socket);
			});
		});
		// Start listening
		return new Promise((resolve, reject) => {
			// Catch error during port open
			this._server.once('error', reject);
			this._server.listen(port, () => {
				// Port open didn't error
				this._server.off('error', reject);
				// Setup error logging
				this._server.on('error', (error) => {
					logger.error('HTTP server Error:', error);
				});
				// Setup shutdown handlers
				logConfig.onFatal.push(() => {
					logger.verbose('Stopping HTTP server');
					this._server.close((err) => {
						if (err) {
							logger.error('Failed to close HTTP server', err);
						} else {
							logger.info('HTTP server closed');
						}
					});
				});
				// Finalize start
				logger.info(`HTTP server started on port ${port}`);
				resolve();
			});
		});
	}

	public onDestroy(): void {
		if (this._server) {
			this._server.unref();
			this._server.close();
		}
		this._activeConnections.forEach((socket) => socket.destroy());
	}
};
