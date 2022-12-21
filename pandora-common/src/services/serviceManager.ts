import type { Logger, LogLevel } from '../logging';

export type Service = {
	init(): Promise<Service> | Service;
	onDestroy?(): Promise<void> | void;
};

type StartupEntry = {
	service?: Service;
	destroyPhase: number;
	onStart?: () => Promise<void> | void;
};

export class ServiceManager {
	private readonly _logger: Logger;
	private readonly _startup: StartupEntry[] = [];
	private readonly _services: Service[][] = [];

	constructor(logger: Logger) {
		this._logger = logger;
	}

	public add<T extends Service>(service: T, destroyPhase = 0, onStart?: (service: T) => Promise<void> | void): ServiceManager {
		this._startup.push({
			service,
			destroyPhase,
			onStart: onStart ? () => onStart(service) : undefined,
		});
		return this;
	}

	public log(level: LogLevel, ...messages: unknown[]): ServiceManager {
		this._startup.push({
			destroyPhase: 0,
			onStart: () => this._logger.logMessage(level, messages),
		});
		return this;
	}

	public async build(): Promise<ServiceManager> {
		for (const { service, destroyPhase, onStart } of this._startup) {
			while (destroyPhase >= this._services.length)
				this._services.push([]);

			if (service) {
				await service.init();
				this._services[destroyPhase].push(service);
			}
			if (onStart)
				await onStart();
		}
		this._startup.length = 0;
		return this;
	}

	public async destroy(): Promise<void> {
		for (const phase of this._services) {
			for (const service of phase) {
				if (service.onDestroy)
					await service.onDestroy();
			}
		}
		this._services.length = 0;
	}
}
