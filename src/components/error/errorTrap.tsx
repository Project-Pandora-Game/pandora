import React, { ReactElement, useCallback, useEffect } from 'react';
import { ChildrenProps } from '../../common/reactTypes';
import { useErrorHandler } from '../../common/useErrorHandler';

export const ErrorTrap = ({ children }: ChildrenProps): ReactElement => {
	const handleError = useErrorHandler();

	const errorListener = useCallback((event: ErrorEvent): void => {
		if (event.error instanceof Error) {
			handleError(event.error);
		} else {
			handleError(new Error(`Uncaught error: ${ String(event.error) }`));
		}
	}, [handleError]);

	const rejectionListener = useCallback((event: PromiseRejectionEvent): void => {
		if (event.reason instanceof Error) {
			handleError(event.reason);
		} else {
			handleError(new Error(`Unhandled promise rejection: ${ String(event.reason) }`));
		}
	}, [handleError]);

	useEffect(() => {
		window.addEventListener('error', errorListener);
		window.addEventListener('unhandledrejection', rejectionListener);
		return () => {
			window.removeEventListener('error', errorListener);
			window.removeEventListener('unhandledrejection', rejectionListener);
		};
	}, [errorListener, rejectionListener]);

	return <>{ children }</>;
};
