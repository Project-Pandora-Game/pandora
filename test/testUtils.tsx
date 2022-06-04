import { render, RenderResult } from '@testing-library/react';
import { InitialEntry } from 'history';
import { noop } from 'lodash';
import React, { ReactElement, useEffect } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';

interface LocationTrackerProps {
	onPathnameUpdate?: (pathname: string) => void;
}

export interface RenderWithRouterOptions extends LocationTrackerProps {
	initialEntries?: InitialEntry[];
}

export function RenderWithRouter(element: ReactElement, {
	onPathnameUpdate = noop,
	initialEntries = ['/'],
}: RenderWithRouterOptions = {}): RenderResult {
	return render(
		<MemoryRouter initialEntries={ initialEntries }>
			{ element }
			<LocationTracker onPathnameUpdate={ onPathnameUpdate } />
		</MemoryRouter>,
	);
}

function LocationTracker({ onPathnameUpdate = noop }: LocationTrackerProps = {}): null {
	const location = useLocation();
	useEffect(() => {
		onPathnameUpdate(location.pathname);
	}, [location.pathname, onPathnameUpdate]);
	return null;
}
