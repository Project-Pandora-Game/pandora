import { useCallback } from 'react';

export function useFunctionBind<TBindArgs extends unknown[], TExtraArgs extends unknown[], TReturn>(fn: (...args: [...TBindArgs, ...TExtraArgs]) => TReturn, ...bindArgs: TBindArgs): (...args: TExtraArgs) => TReturn {
	return useCallback((...extraArgs: TExtraArgs) => {
		return fn(...bindArgs, ...extraArgs);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [fn, ...bindArgs]);
}
