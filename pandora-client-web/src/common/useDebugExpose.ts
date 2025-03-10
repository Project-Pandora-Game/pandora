import { useEffect } from 'react';
import { USER_DEBUG } from '../config/Environment.ts';

export function useDebugExpose(name: string, value: unknown): void {
	if (USER_DEBUG) {
		// eslint-disable-next-line react-hooks/rules-of-hooks
		useEffect(() => {
			//@ts-expect-error: Development link
			window[name] = value;
			return () => {
				//@ts-expect-error: Development link
				delete window[name];
			};
		}, [name, value]);
	}
}
