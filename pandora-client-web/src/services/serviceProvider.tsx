import type { ServiceManager } from 'pandora-common';
import React, { createContext, useContext, type ReactElement } from 'react';
import type { ChildrenProps } from '../common/reactTypes';
import { useDebugExpose } from '../common/useDebugExpose';
import type { ClientServices } from './clientServices';

export const serviceManagerContext = createContext<ServiceManager<ClientServices> | undefined>(undefined);

export interface ServiceManagerContextProviderProps extends ChildrenProps {
	serviceManager: ServiceManager<ClientServices>;
}

export function ServiceManagerContextProvider({ children, serviceManager }: ServiceManagerContextProviderProps): ReactElement | null {
	useDebugExpose('PandoraServiceManager', serviceManager);

	return (
		<serviceManagerContext.Provider value={ serviceManager }>
			{ children }
		</serviceManagerContext.Provider>
	);
}

/**
 * Get access to the client service manager.
 * @note If possible you should prefer using `useService` or `useServiceOptional`.
 */
export function useServiceManagerOptional(): ServiceManager<ClientServices> | null {
	return useContext(serviceManagerContext) ?? null;
}

/**
 * Get access to the client service manager.
 * @note If possible you should prefer using `useService` or `useServiceOptional`.
 */
export function useServiceManager(): ServiceManager<ClientServices> {
	const serviceManager = useContext(serviceManagerContext);
	if (serviceManager == null) {
		throw new Error('Attempt to access ServiceManager outside of context');
	}
	return serviceManager;
}

/**
 * Get a specific service from the service manager. The service might or might not be registered.
 * @param serviceName - The service to get
 */
export function useServiceOptional<const TService extends (keyof ClientServices & string)>(serviceName: TService): ClientServices[TService] | null {
	const serviceManager = useServiceManagerOptional();
	const service = serviceManager?.services[serviceName];
	return service ?? null;
}

/**
 * Get a specific service from the service manager. Errors if the service is not ready.
 * @param serviceName - The service to get
 */
export function useService<const TService extends (keyof ClientServices & string)>(serviceName: TService): ClientServices[TService] {
	const service = useServiceManager().services[serviceName];
	if (service == null) {
		throw new Error(`Attempt to access non-registered service '${serviceName}'`);
	}
	return service;
}
