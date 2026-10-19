type BotRequestKind = 'list' | 'run' | 'structure';

const REQUEST_BURST = 32;
const REQUEST_REFILL_PER_SECOND = 8;

/** Limits bot round trips per character, including across reconnects. */
export class BotCommandRequestLimiter {
	readonly #states = new WeakMap<object, { tokens: number; updatedAt: number; inFlight: Set<BotRequestKind>; }>();

	public acquire(character: object, kind: BotRequestKind, now: number = Date.now()): (() => void) | null {
		let state = this.#states.get(character);
		if (state == null) {
			state = { tokens: REQUEST_BURST, updatedAt: now, inFlight: new Set() };
			this.#states.set(character, state);
		}
		state.tokens = Math.min(REQUEST_BURST, state.tokens + Math.max(0, now - state.updatedAt) * REQUEST_REFILL_PER_SECOND / 1000);
		state.updatedAt = now;
		if (state.tokens < 1 || state.inFlight.has(kind))
			return null;
		state.tokens -= 1;
		state.inFlight.add(kind);
		return () => {
			state.inFlight.delete(kind);
		};
	}
}

export const botCommandRequestLimiter = new BotCommandRequestLimiter();
