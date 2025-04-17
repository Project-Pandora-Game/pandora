import { useMediaQuery } from '../common/useMediaQuery.ts';

export function useIsPortrait(): boolean {
	return useMediaQuery('(orientation: portrait)');
}

export function useIsLandscape(): boolean {
	return !useIsPortrait();
}

export function useIsNarrowScreen(): boolean {
	return useMediaQuery('only screen and (width < 48rem)');
}

export function useIsVeryNarrowScreen(): boolean {
	return useMediaQuery('only screen and (width < 40rem)');
}

/**
 * Returns whether the screen is small in the vertical axis
 */
export function useIsLowScreen(): boolean {
	return useMediaQuery('only screen and (height < 27rem)');
}
