import { TypedEventEmitter, type ITypedEventEmitter, type TypedEvent } from '../event.ts';
import { Assert } from '../utility/misc.ts';
import type { BaseServicesDefinition } from './serviceDefinitions.ts';

/**
 * Base for the service's config. Dictates data available to the service at runtime.
 * This object never exists - it only contains metadata for the service.
 */
export type ServiceConfigBase = {
	dependencies: BaseServicesDefinition;
	events: false | TypedEvent;
};

/** Definition of the service's provider that will be passed to the service manager. */
export type ServiceProviderDefinition<TServices extends BaseServicesDefinition, TName extends (keyof TServices & string), TConfig extends ServiceConfigBase, TExternalDependencies extends BaseServicesDefinition = Record<never, never>> = {
	name: TName;
	ctor: new (serviceInit: ServiceInitArgs<ServiceConfigFixupDependencies<Omit<TServices & TExternalDependencies, TName>, TConfig>>) => (TServices[TName]);
	dependencies: Record<keyof TConfig['dependencies'] & string, true>;
};

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface IService<TConfig extends ServiceConfigBase> extends ITypedEventEmitter<TConfig['events'] extends object ? TConfig['events'] : Record<never, never>> {

}

export abstract class Service<TConfig extends ServiceConfigBase> extends TypedEventEmitter<TConfig['events'] extends object ? TConfig['events'] : Record<never, never>> implements IService<TConfig> {
	/** Name the service was registered under. */
	protected readonly serviceName: string;
	/** Dependencies of this service, available for use. */
	protected readonly serviceDeps: Readonly<TConfig['dependencies']>;

	constructor(serviceInitArgs: ServiceInitArgs<TConfig>) {
		super();
		this.serviceName = serviceInitArgs.serviceName;
		this.serviceDeps = serviceInitArgs.serviceDeps;

		Assert(serviceInitArgs.serviceHandleRef.current == null);
		serviceInitArgs.serviceHandleRef.current = {
			serviceInit: () => this.serviceInit(),
			serviceLoad: () => this.serviceLoad(),
			serviceUnload: () => this.serviceUnload(),
		};
	}

	/**
	 * Lifecycle method of a service.
	 * Called after all services have been constructed and before any load happens.
	 *
	 * During this phase the service should create any complex internal structures (possibly depending on its dependencies)
	 * and it should register itself to its dependencies if they require that.
	 * The service shouldn't interact with the outside world during this phase.
	 */
	protected serviceInit(): void {
		// Default NOOP
	}

	/**
	 * Lifecycle method of a service.
	 * Called after all services have been initialized.
	 *
	 * During this service should perform any setup actions related to the outside world.
	 */
	protected serviceLoad(): void | Promise<void> {
		// Default NOOP
	}

	/**
	 * Lifecycle method of a service.
	 * Called before destruction of the service manager.
	 * It is called in the reverse order of `serviceLoad` calls.
	 *
	 * During this service should perform any cleanup necessary before shutdown. It can still depend on its dependencies being fully initialized.
	 */
	protected serviceUnload(): void | Promise<void> {
		// Default NOOP
	}
}

/** Interface for managing the service. Should only be used by `ServiceManager` */
export interface ServiceManagementInterface {
	serviceInit: () => void;
	serviceLoad: () => void | Promise<void>;
	serviceUnload: () => void | Promise<void>;
}

/** Args passed to a service during its construction. */
export type ServiceInitArgs<TConfig extends ServiceConfigBase> = {
	/** Name the service is being registered under */
	serviceName: string;
	/** Dependencies the service declared, already constructed by this point */
	serviceDeps: Readonly<TConfig['dependencies']>;
	/**
	 * A ref object for the service handle.
	 * It is `null` when passed to the service - service is expected to fill it with correct data.
	 */
	serviceHandleRef: {
		current: ServiceManagementInterface | null;
	};
};

/**
 * Helper for re-typing dependencies of a config the service requires to those the service manager will actually pass along.
 * This is done because in some cases service manager might have more concrete type of a service than the service itself requires as a dependency.
 * It also safeguards against service requesting dependency that the manager doesn't provide, at compile-time.
 */
export type ServiceConfigFixupDependencies<TDependencies extends BaseServicesDefinition, TConfig extends ServiceConfigBase> = {
	dependencies: Pick<TDependencies, keyof TConfig['dependencies'] & string>;
	events: TConfig['events'];
};
