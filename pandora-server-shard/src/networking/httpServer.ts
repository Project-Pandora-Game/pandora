import express from 'express';
import * as fs from 'fs';
import { Socket } from 'net';
import { Server as NodeHttpServer } from 'node:http';
import { Server as NodeHttpsServer } from 'node:https';
import { GetLogger, ServerService } from 'pandora-common';
import { AssetsServe } from '../assets/assetManager.ts';
import { ENV } from '../config.ts';
import { MetricsServe } from '../metrics.ts';
import { SocketIOServerClient } from './socketio_client_server.ts';
const { ASSETS_SOURCE, SERVER_HTTPS_CERT, SERVER_HTTPS_KEY, SERVER_PORT, TRUSTED_REVERSE_PROXY_HOPS } = ENV;

/** Setup HTTP server and everything related to it */
export const HttpServer = new class HttpServer implements ServerService {
	private _server?: NodeHttpServer;
	private readonly _logger = GetLogger('Server');
	private readonly _activeConnections = new Set<Socket>();

	public async init(): Promise<void> {
		// Setup Express application
		const expressApp = express()
			.disable('x-powered-by');

		expressApp.use(function (req, res, next) {
			res.header('Access-Control-Allow-Origin', req.get('Origin') || '*');
			res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE');
			res.header('Access-Control-Expose-Headers', 'Content-Length');
			res.header('Access-Control-Allow-Headers', 'Accept, Authorization, Content-Type, X-Requested-With, Range');
			if (req.method === 'OPTIONS') {
				res.sendStatus(200);
				return;
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
				this._logger.error('Failed to read SERVER_HTTPS_CERT file', e);
				throw new Error('Failed to read SERVER_HTTPS_CERT file');
			}
			let keyData: string;
			try {
				keyData = fs.readFileSync(SERVER_HTTPS_KEY, { encoding: 'utf-8' });
			} catch (e) {
				this._logger.error('Failed to read SERVER_HTTPS_KEY file', e);
				throw new Error('Failed to read SERVER_HTTPS_KEY file');
			}
			this._server = new NodeHttpsServer({
				cert: certData,
				key: keyData,
			}, (req, res) => {
				expressApp(req, res);
			});
		} else {
			// Warn only if we are not behind proxy that handles HTTPS for us
			if (TRUSTED_REVERSE_PROXY_HOPS === 0) {
				this._logger.warning('Starting in HTTP-only mode');
			}
			this._server = new NodeHttpServer((req, res) => {
				expressApp(req, res);
			});
		}
		const server = this._server;
		// Host assets (only if we are supposed to)
		if (!ASSETS_SOURCE) {
			expressApp.use('/assets', AssetsServe());
		}
		// Host metrics
		expressApp.use('/metrics', MetricsServe());

		// Error handling
		const expressErrorHandler: express.ErrorRequestHandler = (err: unknown, req, res, _next): void => {
			this._logger.error(`Error during handling of '${req.method} ${req.url}':\n`, err);
			res.sendStatus(500);
		};
		expressApp.use(expressErrorHandler);

		// Attach socket.io server
		new SocketIOServerClient(server);
		// Keep track of existing connection
		server.on('connection', (socket) => {
			this._activeConnections.add(socket);
			socket.once('close', () => {
				this._activeConnections.delete(socket);
			});
		});
		// Start listening
		return new Promise((resolve, reject) => {
			// Catch error during port open
			server.once('error', reject);
			server.listen(SERVER_PORT, () => {
				// Port open didn't error
				server.off('error', reject);
				// Setup error logging
				server.on('error', (error) => {
					this._logger.error('HTTP server Error:', error);
				});
				// Finalize start
				this._logger.info(`HTTP server started on port ${SERVER_PORT}`);
				resolve();
			});
		});
	}

	public onDestroy(): void {
		if (this._server) {
			this._server.unref();
			this._server.close((err) => {
				if (err) {
					this._logger.error('Failed to close HTTP server', err);
				} else {
					this._logger.info('HTTP server closed');
				}
			});
		}
		this._activeConnections.forEach((socket) => socket.destroy());
	}
};
