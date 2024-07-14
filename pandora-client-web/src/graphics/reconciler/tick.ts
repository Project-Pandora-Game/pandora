import type { Ticker } from 'pixi.js';
import { useEffect } from 'react';
import { usePixiAppOptional } from './appContext';

export function usePixiTick(callback: (dt: number, ticker: Ticker) => void, enabled: boolean = true) {
	const app = usePixiAppOptional();

	useEffect(() => {
		if (app == null || !enabled)
			return;

		const ticker = app.ticker;

		const tick = (dt: number) => {
			callback(dt, ticker);
		};

		ticker.add(tick);

		return () => {
			ticker.remove(tick);
		};
	}, [app, callback, enabled]);
}
