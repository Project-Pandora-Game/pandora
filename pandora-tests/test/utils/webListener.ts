/* eslint-disable no-console */
import { expect, test } from '@playwright/test';
import { Assert } from './utils.ts';
import { Server as NodeHttpServer } from 'node:http';
import { Socket } from 'node:net';
import express from 'express';
import { TEST_LISTENER_HTTP_SERVER_PORT } from '../_setup/config.ts';
import { TestEmailServer } from './emailTestServer.ts';

class TestWebListener {
	private _server?: NodeHttpServer;
	private readonly _activeConnections = new Set<Socket>();

	public readonly emailServer = new TestEmailServer();

	public async init(): Promise<void> {
		// Setup Express application
		const expressApp = express()
			.disable('x-powered-by');

		// Setup HTTP server
		this._server = new NodeHttpServer((req, res) => {
			expressApp(req, res);
		});

		const server = this._server;
		// Attach endpoints
		expressApp.use('/email', this.emailServer.router);

		// Error handling
		const expressErrorHandler: express.ErrorRequestHandler = (err: unknown, req, res, _next): void => {
			console.error(`Error during handling of '${req.method} ${req.url}':\n`, err);
			res.sendStatus(500);

			expect.soft(err).toBeUndefined();
		};
		expressApp.use(expressErrorHandler);

		// Keep track of existing connections
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
			server.listen(TEST_LISTENER_HTTP_SERVER_PORT, () => {
				// Port open didn't error
				server.off('error', reject);
				// Setup error logging
				server.on('error', (error) => {
					console.error('HTTP server Error:', error);
				});
				resolve();
			});
		});
	}

	public stop(): Promise<void> {
		let resolution: Promise<void>;
		if (this._server) {
			resolution = new Promise((resolve, reject) => {
				this._server!.close((err) => {
					if (err) {
						console.error('Failed to close HTTP server', err);
						reject(err);
					} else {
						resolve();
					}
				});
			});
		} else {
			resolution = Promise.resolve();
		}
		this._activeConnections.forEach((socket) => socket.destroy());

		return resolution;
	}
}

let WebListener: TestWebListener | null = null;

export function GetTestWebListener(): TestWebListener {
	Assert(WebListener != null);
	return WebListener;
}

export function InternalSetupTestingWebListener(): void {
	test.beforeEach(async () => {
		Assert(WebListener == null);
		WebListener = new TestWebListener();
		await WebListener.init();
	});

	test.afterEach(async () => {
		if (WebListener != null) {
			const listener = WebListener;
			WebListener = null;
			await listener.stop();
		}
	});
}
