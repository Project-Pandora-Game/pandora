import { render, renderHook, RenderHookResult, RenderOptions, RenderResult } from '@testing-library/react';
import { InitialEntry } from 'history';
import { noop } from 'lodash';
import React, { ComponentType, Dispatch, ReactElement, SetStateAction, useEffect, useMemo } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { ChildrenProps } from '../src/common/reactTypes';
import { DebugContext, debugContext, DebugData } from '../src/components/error/debugContextProvider';
import { directoryConnectorContext } from '../src/components/gameContext/directoryConnectorContextProvider';
import {
	connectorFactoryContext,
	ConnectorFactoryContext,
	shardConnectorContext,
	ShardConnectorContextData,
} from '../src/components/gameContext/shardConnectorContextProvider';
import { DirectoryConnector } from '../src/networking/directoryConnector';
import { ShardConnector } from '../src/networking/shardConnector';
import { MockDebugData } from './mocks/error/errorMocks';
import { MockDirectoryConnector } from './mocks/networking/mockDirectoryConnector';
import { MockShardConnector } from './mocks/networking/mockShardConnector';

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

function MockProvidersProps(overrides?: Partial<Omit<ProvidersProps, 'children'>>): Omit<ProvidersProps, 'children'> {
	return {
		debugData: MockDebugData(),
		setDebugData: jest.fn(),
		directoryConnector: new MockDirectoryConnector(),
		shardConnector: new MockShardConnector(),
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
	directoryConnector: DirectoryConnector;
	shardConnector: ShardConnector | null;
	setShardConnector: Dispatch<SetStateAction<ShardConnector | null>>;
}

export function Providers({
	children, debugData, setDebugData, directoryConnector, shardConnector, setShardConnector,
}: ProvidersProps): ReactElement {
	const debugContextData = useMemo<DebugContext>(() => ({ debugData, setDebugData }), [debugData, setDebugData]);

	const connectorFactoryContextData = useMemo<ConnectorFactoryContext>(() => ({
		shardConnectorFactory: (info) => new MockShardConnector(info),
	}), []);

	const shardConnectorContextData = useMemo<ShardConnectorContextData>(() => ({
		shardConnector,
		setShardConnector,
	}), [shardConnector, setShardConnector]);

	return (
		<debugContext.Provider value={ debugContextData }>
			<connectorFactoryContext.Provider value={ connectorFactoryContextData }>
				<directoryConnectorContext.Provider value={ directoryConnector }>
					<shardConnectorContext.Provider value={ shardConnectorContextData }>
						{ children }
					</shardConnectorContext.Provider>
				</directoryConnectorContext.Provider>
			</connectorFactoryContext.Provider>
		</debugContext.Provider>
	);
}
