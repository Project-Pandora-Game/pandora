import { useContext, useMemo } from 'react';
import { UNSAFE_RouteContext, useLocation, type Location, type Params } from 'react-router';

export interface RoutingParentPath {
	params: Params<string>;
	pathname: string;
	pathnameBase: string;
}

/**
 * Returns pathname and pathname base (so far matched part of path) at the current relative point of the routing context.
 * This allows resolving paths relative to the place this component is mounted in routing hierarchy.
 */
export function useRoutingParentPath(): RoutingParentPath {
	const { matches: parentMatches } = useContext(UNSAFE_RouteContext);
	const routeMatch = parentMatches.length > 0 ? parentMatches[parentMatches.length - 1] : undefined;

	return useMemo((): RoutingParentPath => {
		return {
			params: routeMatch ? routeMatch.params : {},
			pathname: routeMatch ? routeMatch.pathname : '/',
			pathnameBase: routeMatch ? routeMatch.pathnameBase : '/',
		};
	}, [routeMatch]);
}

export interface RoutingRemainingPath extends RoutingParentPath {
	location: Location;
	remainingPathname: string;
}

/**
 * Returns pathname that wasn't yet matched by parent routes, based on current location.
 * This allows checking paths relative to the place this component is mounted in routing hierarchy
 */
export function useRoutingRemainingPath(): RoutingRemainingPath {
	const parentPath = useRoutingParentPath();
	const location = useLocation();

	return useMemo((): RoutingRemainingPath => {
		const locationPathname = location.pathname || '/';
		let remainingPathname = locationPathname;
		if (parentPath.pathnameBase !== '/') {
			const parentSegments = parentPath.pathnameBase.replace(/^\//, '').split('/');
			const segments = locationPathname.replace(/^\//, '').split('/');
			remainingPathname = '/' + segments.slice(parentSegments.length).join('/');
		}

		return {
			...parentPath,
			location,
			remainingPathname,
		};
	}, [parentPath, location]);
}
