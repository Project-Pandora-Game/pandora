import { useMediaQuery } from '../common/useMediaQuery.ts';

export function useIsPortrait(): boolean {
	return useMediaQuery('(orientation: portrait)');
}

export function useIsLandscape(): boolean {
	return !useIsPortrait();
}

export function useIsNarrowScreen(): boolean {
	return useMediaQuery('only screen and (max-width: 719px)');
}

export function useIsVeryNarrowScreen(): boolean {
	return useMediaQuery('only screen and (max-width: 479px)');
}
