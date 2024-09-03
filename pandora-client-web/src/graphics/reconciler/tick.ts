import type { Ticker } from 'pixi.js';
import { useEffect } from 'react';
import { usePixiAppOptional } from './appContext';

/**
 * Adds a tick handler that is called each time a Pixi tick happens (so each time there is a render of the tree)
 * @param callback - The callback that should be called
 * @param enabled - Whether this callback is enabled or not (allowing to disable the tick without calling the hook conditionally)
 */
export function usePixiTick(callback: (ticker: Ticker) => void, enabled: boolean = true) {
	const app = usePixiAppOptional();

	useEffect(() => {
		if (app == null || !enabled)
			return;

		const ticker = app.ticker;

		const tick = (tickerRef: Ticker) => {
			callback(tickerRef);
		};

		ticker.add(tick);

		return () => {
			ticker.remove(tick);
		};
	}, [app, callback, enabled]);
}
