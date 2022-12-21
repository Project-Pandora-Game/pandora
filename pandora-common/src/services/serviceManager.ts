import type { Logger, LogLevel } from '../logging';

export type Service = {
	init(): Promise<Service> | Service;
	onDestroy?(): void;
};

type StartupEntry = {
	service?: Service;
	onStart?: () => Promise<void> | void;
};

export class ServiceManager {
	private readonly _logger: Logger;
	private readonly _startup: StartupEntry[] = [];
	private readonly _services: Service[] = [];

	constructor(logger: Logger) {
		this._logger = logger;
	}

	public add<T extends Service>(service: T, onStart?: (service: T) => Promise<void> | void): void {
		this._startup.push({
			service,
			onStart: onStart ? () => onStart(service) : undefined,
		});
	}

	public log(level: LogLevel, message: string, ...args: unknown[]): void {
		this._startup.push({
			onStart: () => this._logger.log(level, message, ...args),
		});
	}

	public async build(): Promise<void> {
		for (const { service, onStart } of this._startup) {
			if (service) {
				await service.init();
				this._services.push(service);
			}
			if (onStart)
				await onStart();
		}
		this._startup.length = 0;
	}

	public destroy(): void {
		for (const service of this._services) {
			service.onDestroy?.();
		}
		this._services.length = 0;
	}
}
