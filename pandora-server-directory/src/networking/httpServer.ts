import { GetLogger } from 'pandora-common';
import { ENV } from '../config';
const { SERVER_HTTPS_CERT, SERVER_HTTPS_KEY, SERVER_PORT, TRUSTED_REVERSE_PROXY_HOPS } = ENV;
import { Server as HttpServer } from 'http';
import { Server as HttpsServer } from 'https';
import * as fs from 'fs';
import { SocketIOServerShard } from './socketio_shard_server';
import { SocketIOServerClient } from './socketio_client_server';
import { Socket } from 'net';
import express from 'express';
import { MetricsServe } from '../metrics';
import { GitHubVerifierAPI } from '../services/github/githubVerify';

const logger = GetLogger('Server');

let server: HttpServer;

const activeConnections = new Set<Socket>();

/** Setup HTTP server and everything related to it */
export function StartHttpServer(): Promise<void> {
	// Setup Express application
	const expressApp = express()
		.disable('x-powered-by');

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
		server = new HttpsServer({
			cert: certData,
			key: keyData,
		}, expressApp);
	} else {
		// Warn only if we are not behind proxy that handles HTTPS for us
		if (TRUSTED_REVERSE_PROXY_HOPS === 0) {
			logger.warning('Starting in HTTP-only mode');
		}
		server = new HttpServer(expressApp);
	}
	// Host metrics
	expressApp.use('/metrics', MetricsServe());
	// APIs
	expressApp.use('/api/github', GitHubVerifierAPI());
	// Attach socket.io servers
	new SocketIOServerClient(server);
	new SocketIOServerShard(server);
	// Keep track of existing connection
	server.on('connection', (socket) => {
		activeConnections.add(socket);
		socket.once('close', () => {
			activeConnections.delete(socket);
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
				logger.error('HTTP server Error:', error);
			});
			// Finalize start
			logger.info(`HTTP server started on port ${SERVER_PORT}`);
			resolve();
		});
	});
}

export function StopHttpServer(): void {
	if (server) {
		server.unref();
		server.close((err) => {
			if (err) {
				logger.error('Failed to close HTTP server', err);
			} else {
				logger.info('HTTP server closed');
			}
		});
	}
	activeConnections.forEach((socket) => socket.destroy());
}
