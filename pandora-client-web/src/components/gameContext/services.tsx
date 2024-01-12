import React from 'react';
import { Service, ServiceManager, ServiceName, ServiceInstanceType } from './serviceManager';
import { useObservable } from '../../observable';
import { Assert } from 'pandora-common';

class DirectoryConnector {}

class ShardConnector {
	public readonly directoryConnector: DirectoryConnector;

	constructor(props: { directoryConnector: DirectoryConnector; }, {}: { test: string; }) {
		this.directoryConnector = props.directoryConnector;
	}
}

const directoryConnector = new Service({
	name: 'directoryConnector',
	ctor: DirectoryConnector,
	hasArgs: false,
});

directoryConnector.addDependencies(false);

const shardConnector = new Service({
	name: 'shardConnector',
	ctor: ShardConnector,
	hasArgs: true,
});

shardConnector.addDependencies({
	directoryConnector: true,
});

const serviceManger = new ServiceManager([
	directoryConnector,
	shardConnector,
]);

declare module './serviceManager' {
	interface Register {
		serviceManager: typeof serviceManger;
	}
}

const context = React.createContext(serviceManger);

export const ServiceProvider = context.Provider;

export function ServiceManagerInit(): Promise<void> {
	return serviceManger.init();
}

export function useServiceRaw<TServiceName extends ServiceName>(name: TServiceName): [ServiceInstanceType<TServiceName>] | null {
	const serviceManager = React.useContext(context);
	return useObservable(serviceManager.getServiceObserver(name));
}

export function useServiceNullable<TServiceName extends ServiceName>(name: TServiceName): ServiceInstanceType<TServiceName> | null {
	const service = useServiceRaw(name);
	return service ? service[0] : null;
}

export function useService<TServiceName extends ServiceName>(name: TServiceName): ServiceInstanceType<TServiceName> {
	const service = useServiceRaw(name);
	Assert(service != null, `Service ${name} not found`);
	return service[0];
}

export function Test() {
	serviceManger.createService('shardConnector', { test: 'test' })
		.catch(() => { /** */ });
	const directory = useService('directoryConnector');
	const shard = useService('shardConnector');
	Assert(directory instanceof DirectoryConnector);
	Assert(shard instanceof ShardConnector);
}
