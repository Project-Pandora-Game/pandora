import { useCallback } from 'react';
import { useNavigate, type NavigateOptions, type To } from 'react-router';
import { useErrorHandler } from '../common/useErrorHandler.ts';

export interface NavigateFunctionPandora {
	(to: To, options?: NavigateOptions): void;
	(delta: number): void;
}

export function useNavigatePandora(): NavigateFunctionPandora {
	const routerNavigate = useNavigate();
	const handleError = useErrorHandler();

	return useCallback<NavigateFunctionPandora>(
		(to: To | number, options?: NavigateOptions) => {
			try {
				if (typeof to === 'number') {
					routerNavigate(to)
						?.catch(handleError);
				} else {
					routerNavigate(to, options)
						?.catch(handleError);
				}
			} catch (error) {
				handleError(error);
			}
		},
		[routerNavigate, handleError],
	);
}
