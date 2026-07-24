import { GetLogger, ParseNotNullable, type PandoraAccessToken, type ServiceManager } from 'pandora-common';
import type { ApiDirectoryConnector } from './apiDirectoryConnector.ts';
import { GenerateApiDirectoryServices, type ApiDirectoryServices } from './apiDirectoryServices.ts';
import { SocketIOConnector } from './socketio_connector.ts';

export class InternalApiDirectory {
	public readonly logger = GetLogger('PandoraApi');

	public readonly serviceManager: ServiceManager<ApiDirectoryServices>;

	public get directoryConnector(): ApiDirectoryConnector {
		return ParseNotNullable(this.serviceManager.services.directoryConnector);
	}

	constructor() {
		this.serviceManager = GenerateApiDirectoryServices();
	}

	public async init(): Promise<void> {
		await this.serviceManager.load();
	}

	public async connectToServer(url: string, token: PandoraAccessToken): Promise<void> {
		const cleanup: (() => void)[] = [];
		try {
			await new Promise((resolve, reject) => {
				cleanup.push(this.directoryConnector.on('connected', resolve));
				cleanup.push(this.directoryConnector.on('connectError', (err) => {
					this.directoryConnector.disconnect();
					reject(new Error('Connection error', { cause: err }));
				}));

				this.directoryConnector.connect(url, token, SocketIOConnector);
			});
		} finally {
			cleanup.forEach((f) => f());
		}
	}

	public close(): void {
		this.directoryConnector.disconnect();
	}
}
