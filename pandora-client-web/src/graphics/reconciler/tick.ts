import { AssertNotNullable, TypedEventEmitter } from 'pandora-common';
import type { Ticker } from 'pixi.js';
import { createContext, useCallback, useContext, useEffect, useRef, type RefObject } from 'react';

export const PixiTickerContext = createContext<PixiTicker | null>(null);

export class PixiTicker extends TypedEventEmitter<{ tick: Ticker; }> {
	public readonly tick = (ticker: Ticker): void => {
		this.emit('tick', ticker);
	};
}

/**
 * Adds a tick handler that is called each time a Pixi tick happens (so each time there is a render of the tree)
 * @param callback - The callback that should be called
 * @param enabled - Whether this callback is enabled or not (allowing to disable the tick without calling the hook conditionally)
 */
export function usePixiTick(callback: (ticker: Ticker) => void, enabled: boolean = true) {
	const tickerContext = useContext(PixiTickerContext);
	AssertNotNullable(tickerContext);

	useEffect(() => {
		if (!enabled)
			return;

		return tickerContext.on('tick', callback);
	}, [tickerContext, callback, enabled]);
}

export type TickerRef = RefObject<((ticker: Ticker) => void) | null>;

export function useTickerRef(): TickerRef {
	const ref = useRef<((ticker: Ticker) => void) | null>(null);

	const callback = useCallback((ticker: Ticker) => {
		ref.current?.(ticker);
	}, []);
	usePixiTick(callback);

	return ref;
}
