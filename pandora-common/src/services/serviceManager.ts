import { pick } from 'lodash-es';
import { Assert, CheckPropertiesNotNullable, KnownObject } from '../utility/misc.ts';
import type { ServiceConfigBase, ServiceConfigFixupDependencies, ServiceInitArgs, ServiceManagementInterface, ServiceProviderDefinition } from './service.ts';
import type { BaseServicesDefinition } from './serviceDefinitions.ts';

/** Lifecycle phases of the ServiceManager */
export enum ServiceManagerInitState {
	/**
	 * The initial phase - construction.
	 * During this phase new services can be registered.
	 * It is expected that the services are being registered in order that satisfies their dependencies.
	 */
	CONSTRUCT,
	/**
	 * The init phase.
	 * During this phase all wanted services must already be registered, as they cannot be added by this point.
	 * The registered servies should perform their internal setup and registrations to other services during it.
	 * Services shouldn't interact with the world (anything except other services) during init.
	 * Called in the same order as the services were registered.
	 */
	INIT,
	/**
	 * The load phase.
	 * During this phase all services can start interacting with the world, potentially asynchronously.
	 * They can expect that all services have been initialized by this point and no more init actions will happen on the service.
	 * Services are loaded one at a time, in the same order as the services were registered,
	 * waiting for each load to complete before continuing to the next service.
	 */
	LOAD,
	/** The service manager's load finished and all services are ready and active. */
	READY,
	/**
	 * The unload phase is triggered by calling `destroy` on a `READY` service manager.
	 * During this phase all services are unloaded in the reverse order they were loaded in.
	 * The services are expected to unload and cleanup any external interactions.
	 * When a service gets unloaded all dependant services will have finished unload by that point.
	 */
	UNLOAD,
	/**
	 * The service manager's unload phase finished and all services have been unloaded and freed.
	 * The service manager or its services cannot be used again.
	 */
	DESTROY,
}

export interface ServiceProvider<out TServices extends BaseServicesDefinition> {
	/** The currently registered services */
	readonly services: Readonly<Partial<TServices>>;
}

/**
 * Service manager contains, manages and provices all services the platform uses.
 * If there is a code that is independent from UI and doesn't have multiple instances,
 * it most likely runs as a service.
 */
export class ServiceManager<TServices extends BaseServicesDefinition, TExternalDependencies extends BaseServicesDefinition = Record<never, never>> implements ServiceProvider<TServices> {
	private readonly _externalDependencies: Partial<TExternalDependencies>;
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

	public get services(): Readonly<Partial<TServices>> {
		return this._services;
	}

	constructor(externalDependencies: Partial<TExternalDependencies>) {
		this._externalDependencies = externalDependencies;
	}

	/**
	 * Register service to the manager.
	 * Dependencies of this service need to have been registered before it.
	 * @param provider - A provider containing metadata about the service and allowing its construction
	 * @returns `this` for chaining
	 */
	public registerService<TName extends (keyof TServices & string), TConfig extends ServiceConfigBase>(
		provider: ServiceProviderDefinition<TServices, TName, TConfig, TExternalDependencies>,
	): this {
		Assert(this._state === ServiceManagerInitState.CONSTRUCT, 'Service cannot be registered after some were loaded');

		const name = provider.name;
		if (this._services[name] != null) {
			throw new Error(`Service '${name}' already registered`);
		}

		// Collect all dependencies. They need to have been registered before this service.
		type ServiceConfigFixup = ServiceConfigFixupDependencies<Omit<TServices & TExternalDependencies, TName>, TConfig>;
		const allDeps: Partial<TServices & TExternalDependencies> = {};
		Object.assign(allDeps, this._externalDependencies);
		Object.assign(allDeps, this._services);
		const dependencies: Partial<ServiceConfigFixup['dependencies']> = pick(allDeps, KnownObject.keys(provider.dependencies));
		if (!CheckPropertiesNotNullable<ServiceConfigFixup['dependencies']>(dependencies, provider.dependencies)) {
			const missingDependency = KnownObject.keys(provider.dependencies).find((k) => this._services[k] == null);
			throw new Error(`Dependencies are not satisfied. Missing dependency: ${missingDependency}`);
		}

		// Put together init args for the service
		const serviceInit: ServiceInitArgs<ServiceConfigFixup> = {
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
