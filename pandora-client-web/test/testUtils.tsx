import { render, renderHook, RenderHookResult, RenderOptions, RenderResult } from '@testing-library/react';
import { InitialEntry } from 'history';
import { noop } from 'lodash';
import React, { ComponentType, Dispatch, ReactElement, SetStateAction, useEffect, useMemo } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { ChildrenProps } from '../src/common/reactTypes';
import { DebugContext, debugContext, DebugData } from '../src/components/error/debugContextProvider';
import {
	connectorFactoryContext,
	ConnectorFactoryContext,
	shardConnectorContext,
	ShardConnectorContextData,
} from '../src/components/gameContext/shardConnectorContextProvider';
import { DirectoryConnectorServiceProvider } from '../src/networking/directoryConnector';
import { ShardConnector } from '../src/networking/shardConnector';
import { MockDebugData } from './mocks/error/errorMocks';
import { MockConnectionInfo } from './mocks/networking/mockShardConnector';
import { Assert, ServiceManager } from 'pandora-common';
import { ServiceManagerContextProvider } from '../src/services/serviceProvider';

export function RenderWithRouter(
	element: ReactElement,
	{ onPathnameUpdate = noop, initialEntries = ['/'] }: Omit<TestRouterProps, 'children'> = {},
	options?: RenderOptions,
): RenderResult {
	return render(
		<TestRouter initialEntries={ initialEntries } onPathnameUpdate={ onPathnameUpdate }>
			{ element }
		</TestRouter>,
		options,
	);
}

export function RenderWithProviders(
	element: ReactElement,
	props: Omit<ProvidersProps, 'children'>,
	options?: RenderOptions,
): RenderResult {
	return render(
		<Providers { ...props }>{ element }</Providers>,
		options,
	);
}

export function RenderWithRouterAndProviders(
	element: ReactElement,
	props: Omit<Partial<ProvidersProps> & TestRouterProps, 'children'> = {},
	options?: RenderOptions,
): RenderResult {
	const {
		initialEntries = ['/'],
		onPathnameUpdate = noop,
		...providersProps
	} = props;
	return render(
		<Providers { ...MockProvidersProps(providersProps) }>
			<TestRouter initialEntries={ initialEntries } onPathnameUpdate={ onPathnameUpdate }>
				{ element }
			</TestRouter>
		</Providers>,
		options,
	);
}

export function RenderHookWithProviders<Result, Props>(
	hook: (initialProps?: Props) => Result,
	providersPropOverrides?: Partial<Omit<ProvidersProps, 'children'>>,
	initialProps?: Props,
): RenderHookResult<Result, Props> {
	return renderHook(hook, {
		initialProps,
		wrapper: CreateCurriedProviders(MockProvidersProps(providersPropOverrides)),
	});
}

function CreateCurriedProviders(propOverrides?: Partial<Omit<ProvidersProps, 'children'>>): ComponentType<ChildrenProps> {
	return function curriedProviders({ children }: ChildrenProps): ReactElement {
		return <Providers { ...MockProvidersProps(propOverrides) }>{ children }</Providers>;
	};
}

export function MockServiceManager(): ServiceManager<ClientServices> {
	return new ServiceManager<ClientServices>()
		.registerService(DirectoryConnectorServiceProvider);
}

function MockProvidersProps(overrides?: Partial<Omit<ProvidersProps, 'children'>>): Omit<ProvidersProps, 'children'> {
	const serviceManager = overrides?.serviceManager ?? MockServiceManager();
	const directoryConnector = serviceManager.services.directoryConnector;
	Assert(directoryConnector != null);

	return {
		debugData: MockDebugData(),
		setDebugData: jest.fn(),
		serviceManager,
		shardConnector: new ShardConnector(MockConnectionInfo(), directoryConnector),
		setShardConnector: jest.fn(),
		...overrides,
	};
}

export interface LocationTrackerProps {
	onPathnameUpdate?: (pathname: string) => void;
}

export interface TestRouterProps extends LocationTrackerProps, ChildrenProps {
	initialEntries?: InitialEntry[];
}

export function TestRouter({ children, initialEntries, onPathnameUpdate }: TestRouterProps): ReactElement {
	return (
		<MemoryRouter initialEntries={ initialEntries }>
			{ children }
			<LocationTracker onPathnameUpdate={ onPathnameUpdate } />
		</MemoryRouter>
	);
}

function LocationTracker({ onPathnameUpdate = noop }: LocationTrackerProps = {}): null {
	const location = useLocation();
	useEffect(() => {
		onPathnameUpdate(location.pathname);
	}, [location.pathname, onPathnameUpdate]);
	return null;
}

export interface ProvidersProps extends ChildrenProps {
	debugData: DebugData;
	setDebugData: (debugData: DebugData) => void;
	serviceManager: ServiceManager<ClientServices>;
	shardConnector: ShardConnector | null;
	setShardConnector: Dispatch<SetStateAction<ShardConnector | null>>;
}

export function Providers({
	children, debugData, setDebugData, shardConnector, setShardConnector, serviceManager,
}: ProvidersProps): ReactElement {
	const debugContextData = useMemo<DebugContext>(() => ({ debugData, setDebugData }), [debugData, setDebugData]);

	const finalServiceManager = useMemo((): ServiceManager<ClientServices> => {
		if (serviceManager != null)
			return serviceManager;

		return new ServiceManager<ClientServices>()
			.registerService(DirectoryConnectorServiceProvider);
	}, [serviceManager]);
	const directoryConnector = finalServiceManager.services.directoryConnector;
	Assert(directoryConnector != null);

	const connectorFactoryContextData = useMemo<ConnectorFactoryContext>(() => ({
		shardConnectorFactory: (info) => new ShardConnector(info, directoryConnector),
	}), [directoryConnector]);

	const shardConnectorContextData = useMemo<ShardConnectorContextData>(() => ({
		shardConnector,
		setShardConnector,
	}), [shardConnector, setShardConnector]);

	return (
		<debugContext.Provider value={ debugContextData }>
			<ServiceManagerContextProvider serviceManager={ finalServiceManager } >
				<connectorFactoryContext.Provider value={ connectorFactoryContextData }>
					<shardConnectorContext.Provider value={ shardConnectorContextData }>
						{ children }
					</shardConnectorContext.Provider>
				</connectorFactoryContext.Provider>
			</ServiceManagerContextProvider>
		</debugContext.Provider>
	);
}
