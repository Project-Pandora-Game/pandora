/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { Assert } from 'pandora-common';
import { Observable } from '../../observable';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface Register { }

export class Service<
	TName extends string,
	TServiceType extends new (inject: any) => any,
> {
	public readonly name: TName;
	public readonly ctor: TServiceType;
	public readonly hardDependencies: string[] = [];
	public readonly softDependencies: string[] = [];
	public readonly service: Observable<[InstanceType<TServiceType>] | null> = new Observable<[InstanceType<TServiceType>] | null>(null);
	public depsAdded = false;

	constructor(props: {
		name: TName;
		ctor: TServiceType;
	}) {
		this.name = props.name;
		this.ctor = props.ctor;
	}

	public addDependencies(deps: ServiceDeps<TServiceType>): void {
		Assert(!this.depsAdded, 'Dependencies already added');
		this.depsAdded = true;
		if (!deps)
			return;

		for (const [key, value] of Object.entries(deps)) {
			if (value) {
				this.hardDependencies.push(key);
			} else {
				this.softDependencies.push(key);
			}
		}
	}
}

type AnyService = Service<string, any>;

export class ServiceManager<TServices extends AnyService[]> {
	private readonly _services: Map<string, AnyService> = new Map();
	public readonly services: TServices;

	constructor(services: TServices) {
		this.services = services;
		for (const service of services) {
			Assert(!this._services.has(service.name), `Service ${service.name} already registered`);
			Assert(service.depsAdded, `Dependencies not added for service ${service.name}`);
			this._services.set(service.name, service);
		}
	}

	public getService<TServiceName extends ServiceName>(name: TServiceName): ServiceType<TServiceName> {
		const service = this._services.get(name);
		if (service == null) {
			throw new Error(`Service ${name} not found`);
		}
		return service as ServiceType<TServiceName>;
	}

	public async init(): Promise<void> {
		while (await this.createAll());
	}

	private async createAll(): Promise<boolean> {
		let created = false;
		for (const service of this.services) {
			if (service.service.value != null)
				continue;

			if (await this.create(service))
				created = true;
		}
		return created;
	}

	private async create(service: AnyService): Promise<boolean> {
		const deps: Record<string, any> = {};
		for (const name of service.hardDependencies) {
			const dep = this.getService(name as ServiceName);
			if (!dep.service) {
				// TODO await service.onDestroy();
				service.service.value = null;
				return false;
			}
			deps[name] = dep.service;
		}
		for (const name of service.softDependencies) {
			const dep = this.getService(name as ServiceName);
			if (dep.service) deps[name] = dep.service;
			else deps[name] = null;
		}
		const instance = new service.ctor(deps);
		// TODO await instance.init();
		await Promise.resolve();
		service.service.value = [instance];
		return true;
	}
}

type ExtractName<TService> = TService extends Service<infer TName, any> ? TName : never;
type ExtractNames<TServices extends AnyService[]> = {
	[K in keyof TServices]: ExtractName<TServices[K]>;
};
type ServiceMap< TServices extends AnyService[]> = {
	[K in ExtractNames<TServices>[number]]: Extract<TServices[number], { name: K; }>;
};
type ServiceManagerType = Register['serviceManager'];
type Services = ServiceManagerType['services'];
export type ServiceName = ExtractNames<Services>[number];
type ServiceType<TServiceName extends ServiceName> = ServiceMap<Services>[TServiceName];
export type ServiceInstanceType<TServiceName extends ServiceName> = InstanceType<ServiceType<TServiceName>['ctor']>;

type ServiceDeps<TServiceType> = TServiceType extends new (inject: Record<infer K, any>) => any ? K extends ServiceName ? Record<K, true> : false : never;
