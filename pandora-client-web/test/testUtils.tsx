import { render, renderHook, RenderHookResult, RenderOptions, RenderResult } from '@testing-library/react';
import { InitialEntry } from 'history';
import { noop } from 'lodash-es';
import { Assert, ServiceManager } from 'pandora-common';
import { ComponentType, ReactElement, useEffect, useMemo } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { ChildrenProps } from '../src/common/reactTypes.ts';
import { DebugContext, debugContext, DebugData } from '../src/components/error/debugContextProvider.tsx';
import { DirectoryConnectorServiceProvider } from '../src/networking/directoryConnector.ts';
import { ROUTER_FUTURE_CONFIG } from '../src/routing/config.ts';
import { GenerateClientUsermodeServices, type ClientServices } from '../src/services/clientServices.ts';
import { ServiceManagerContextProvider } from '../src/services/serviceProvider.tsx';
import { MockDebugData } from './mocks/error/errorMocks.ts';
const jest = import.meta.jest; // Jest is not properly injected in ESM

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
	return GenerateClientUsermodeServices();
}

function MockProvidersProps(overrides?: Partial<Omit<ProvidersProps, 'children'>>): Omit<ProvidersProps, 'children'> {
	const serviceManager = overrides?.serviceManager ?? MockServiceManager();

	return {
		debugData: MockDebugData(),
		setDebugData: jest.fn(),
		serviceManager,
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
		<MemoryRouter initialEntries={ initialEntries } future={ ROUTER_FUTURE_CONFIG }>
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
}

export function Providers({
	children, debugData, setDebugData, serviceManager,
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

	return (
		<debugContext.Provider value={ debugContextData }>
			<ServiceManagerContextProvider serviceManager={ finalServiceManager } >
				{ children }
			</ServiceManagerContextProvider>
		</debugContext.Provider>
	);
}
