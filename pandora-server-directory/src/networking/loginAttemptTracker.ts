/** Per-username password failure tracking. Mirrors case-insensitive account lookup. */
export class LoginAttemptTracker {
	readonly #attempts = new Map<string, number[]>();
	#overflowUntil = 0;
	private readonly windowMs: number;
	private readonly limit: number;
	private readonly maxTrackedNames: number;

	constructor(
		windowMs: number,
		limit: number,
		maxTrackedNames: number = 10_000,
	) {
		this.windowMs = windowMs;
		this.limit = limit;
		this.maxTrackedNames = maxTrackedNames;
	}

	public recordFailure(username: string, now: number = Date.now()): void {
		const key = username.toLowerCase();
		const attempts = this.#recentAttempts(key, now);
		if (attempts.length === 0 && this.#attempts.size >= this.maxTrackedNames) {
			this.#pruneExpired(now);
			if (this.#attempts.size >= this.maxTrackedNames) {
				// Never discard an active username's failures: otherwise spraying
				// new names would remove an existing CAPTCHA requirement.
				this.#overflowUntil = Math.max(this.#overflowUntil, now + this.windowMs);
				return;
			}
		}
		attempts.push(now);
		if (attempts.length > this.limit)
			attempts.shift();

		this.#attempts.set(key, attempts);
	}

	public requiresCaptcha(username: string, now: number = Date.now()): boolean {
		const key = username.toLowerCase();
		if (this.#recentAttempts(key, now).length >= this.limit)
			return true;
		return !this.#attempts.has(key) && this.#overflowUntil > now;
	}

	#pruneExpired(now: number): void {
		for (const [name, timestamps] of this.#attempts) {
			if (timestamps[timestamps.length - 1] + this.windowMs <= now)
				this.#attempts.delete(name);
		}
	}

	#recentAttempts(key: string, now: number): number[] {
		const attempts = this.#attempts.get(key)?.filter((timestamp) => timestamp + this.windowMs > now) ?? [];
		if (attempts.length === 0)
			this.#attempts.delete(key);
		return attempts;
	}
}
