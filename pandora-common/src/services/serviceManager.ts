import { pick } from 'lodash';
import { Assert, CheckPropertiesNotNullable, KnownObject } from '../utility';
import type { ServiceConfigBase, ServiceConfigFixupDependencies, ServiceInitArgs, ServiceManagementInterface, ServiceProviderDefinition } from './service';
import type { BaseServicesDefinition } from './serviceDefinitions';

export enum ServiceManagerInitState {
	CONSTRUCT,
	INIT,
	LOAD,
	READY,
	UNLOAD,
	DESTROY,
}

export class ServiceManager<TServices extends BaseServicesDefinition> {
	/** Services registered to the manager */
	private readonly _services: Partial<TServices> = {};
	/** Handles to individual services, in the order of their registration */
	private readonly _serviceHandles: Readonly<ServiceManagementInterface>[] = [];
	/** The current state of the service manager */
	private _state: ServiceManagerInitState = ServiceManagerInitState.CONSTRUCT;

	/** The current state of the service manager */
	public get state(): ServiceManagerInitState {
		return this._state;
	}

	/** The currently registered services */
	public get services(): Readonly<Partial<TServices>> {
		return this._services;
	}

	/**
	 * Register service to the manager.
	 * Dependencies of this service need to have been registered before it.
	 * @param provider - A provider containing metadata about the service and allowing its construction
	 * @returns `this` for chaining
	 */
	public registerService<TName extends (keyof TServices & string), TConfig extends ServiceConfigBase>(provider: ServiceProviderDefinition<TServices, TName, TConfig>): this {
		Assert(this._state === ServiceManagerInitState.CONSTRUCT, 'Service cannot be registered after some were loaded');

		const name = provider.name;
		if (this._services[name] != null) {
			throw new Error(`Service '${name}' already registered`);
		}

		// Collect all dependencies. They need to have been registered before this service.
		const dependencies: Partial<ServiceConfigFixupDependencies<TServices, TConfig>['dependencies']> = pick(this._services, KnownObject.keys(provider.dependencies));
		if (!CheckPropertiesNotNullable<ServiceConfigFixupDependencies<TServices, TConfig>['dependencies'], keyof ServiceConfigFixupDependencies<TServices, TConfig>['dependencies']>(dependencies, provider.dependencies)) {
			const missingDependency = KnownObject.keys(provider.dependencies).find((k) => this._services[k] == null);
			throw new Error(`Dependencies are not satisfied. Missing dependency: ${missingDependency}`);
		}

		// Put together init args for the service
		const serviceInit: ServiceInitArgs<ServiceConfigFixupDependencies<TServices, TConfig>> = {
			serviceName: name,
			serviceDeps: dependencies,
			serviceHandleRef: { current: null },
		};

		// Construct the service
		const service = new (provider.ctor)(serviceInit);

		// The service is expected to register its private handle through the ref
		const serviceHandle = serviceInit.serviceHandleRef.current;
		Assert(serviceHandle != null, `Service '${name}' did not register handle during construction.`);

		this._services[name] = service;
		this._serviceHandles.push(serviceHandle);

		return this;
	}

	public async load(): Promise<void> {
		Assert(this._state === ServiceManagerInitState.CONSTRUCT, 'Cannot load services while not in the construct phase');

		// Run init
		this._state = ServiceManagerInitState.INIT;
		for (const service of this._serviceHandles) {
			service.serviceInit();
		}

		// Run load
		this._state = ServiceManagerInitState.LOAD;
		for (const service of this._serviceHandles) {
			await service.serviceLoad();
		}

		this._state = ServiceManagerInitState.READY;
	}

	public async destroy(): Promise<void> {
		Assert(this._state === ServiceManagerInitState.READY, 'Cannot destroy services while not in the ready phase');

		// Destroy services in the reverse order
		this._state = ServiceManagerInitState.UNLOAD;
		const reverseOrderServiceHandles = this._serviceHandles.slice().reverse();
		for (const service of reverseOrderServiceHandles) {
			await service.serviceUnload();
		}

		this._state = ServiceManagerInitState.DESTROY;
		// Clear all services from internal structures to allow their cleanup in case the service manager itself still has some references
		for (const serviceName of KnownObject.keys(this._services)) {
			delete this._services[serviceName];
		}
		this._serviceHandles.splice(0, this._serviceHandles.length);
	}
}

// Old services code

export type ServerService = {
	init?(): Promise<void> | void;
	onDestroy?(): Promise<void> | void;
};

export async function ServiceInit(service: ServerService): Promise<void> {
	if (service.init) {
		await service.init();
	}
}
