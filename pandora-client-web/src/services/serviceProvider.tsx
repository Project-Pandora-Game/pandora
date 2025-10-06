import type { ServiceProvider } from 'pandora-common';
import { createContext, useContext, type ReactElement } from 'react';
import type { ChildrenProps } from '../common/reactTypes.ts';
import { useDebugExpose } from '../common/useDebugExpose.ts';
import type { ClientServices } from './clientServices.ts';

export const serviceManagerContext = createContext<ServiceProvider<ClientServices> | undefined>(undefined);

export interface ServiceManagerContextProviderProps extends ChildrenProps {
	serviceManager: ServiceProvider<ClientServices>;
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
export function useServiceManager(): ServiceProvider<ClientServices> {
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
	const serviceManager = useServiceManager();
	const service = serviceManager?.services[serviceName];
	return service ?? null;
}

/**
 * Get a specific service from the service manager. Errors if the service is not ready.
 * @param serviceName - The service to get
 */
export function useService<const TService extends (keyof ClientServices & string)>(serviceName: TService): ClientServices[TService] {
	const service = useServiceOptional(serviceName);
	if (service == null) {
		throw new Error(`Attempt to access non-registered service '${serviceName}'`);
	}
	return service;
}
