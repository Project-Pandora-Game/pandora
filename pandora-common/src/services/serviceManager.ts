import type { Logger, LogLevel } from '../logging';

export type Service = {
	init(): Promise<Service> | Service;
	onDestroy?(): Promise<void> | void;
};

type StartupEntry = {
	service?: never;
	destroyPhase?: never;
	onStart: () => Promise<void> | void;
} | {
	service: Service;
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

	public add<T extends Service>(service: T): ServiceManager;
	public add<T extends Service>(service: T, destroyPhase: number): ServiceManager;
	public add<T extends Service>(service: T, onStartWitService: (service: T) => Promise<void> | void): ServiceManager;
	public add<T extends Service>(service: T, destroyPhase: number, onStartWitService: (service: T) => Promise<void> | void): ServiceManager;
	public add<T extends Service>(service: T, second: number | ((service: T) => Promise<void> | void) = 0, onStartWitService?: (service: T) => Promise<void> | void): ServiceManager {
		let destroyPhase = 0;
		if (typeof second === 'number') {
			destroyPhase = second;
		} else if (typeof second === 'function') {
			onStartWitService = second;
		}
		const onStart = onStartWitService?.bind(undefined, service);
		this._startup.push({
			service,
			destroyPhase,
			onStart,
		});
		return this;
	}

	public action(onStart: () => Promise<unknown> | unknown): ServiceManager {
		this._startup.push({
			onStart: () => void onStart(),
		});
		return this;
	}

	public log(level: LogLevel, ...messages: unknown[]): ServiceManager {
		this._startup.push({
			onStart: () => this._logger.logMessage(level, messages),
		});
		return this;
	}

	public async build(): Promise<ServiceManager> {
		for (const { service, destroyPhase, onStart } of this._startup) {
			if (service) {
				while (destroyPhase >= this._services.length)
					this._services.push([]);

				this._services[destroyPhase].push(await service.init());
			}
			if (onStart)
				await onStart();
		}
		this._startup.length = 0;
		return this;
	}

	public async destroy(): Promise<void> {
		for (const phase of this._services) {
			for (const service of phase.reverse()) {
				if (service.onDestroy)
					await service.onDestroy();
			}
		}
		this._services.length = 0;
	}
}
