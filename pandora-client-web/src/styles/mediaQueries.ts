import { useMediaQuery } from '../common/useMediaQuery';

export function useIsPortrait(): boolean {
	return useMediaQuery('(orientation: portrait)');
}

export function useIsLandscape(): boolean {
	return !useIsPortrait();
}
