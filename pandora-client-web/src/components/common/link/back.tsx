import { IsObject } from 'pandora-common';
import { ReactElement, ReactNode, useCallback } from 'react';
import { Link, useLocation } from 'react-router';
import { useNavigatePandora } from '../../../routing/navigate.ts';

export function BackLink({ children }: {
	children: ReactNode;
}): ReactElement {
	const backLocation = useBackLocation();

	return (
		<Link to={ backLocation }>{ children }</Link>
	);
}

export function useBackLocation(): string {
	const state: unknown = useLocation().state;

	return (IsObject(state) && typeof state.back === 'string') ? state.back : '/';
}

export function useNavigateBack(): () => void {
	const backLocation = useBackLocation();
	const navigate = useNavigatePandora();

	return useCallback(() => {
		navigate(backLocation);
	}, [backLocation, navigate]);
}
