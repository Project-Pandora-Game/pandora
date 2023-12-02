import { Assert, AssertNotNullable } from 'pandora-common';
import { useEffect } from 'react';

type PriorityEntry = {
	readonly delay: number;
	readonly queue: (() => void)[];
};

export class CalculationQueue<const TPriorities extends Readonly<Record<string, number>>> {
	private readonly _priorities: ReadonlyMap<string, PriorityEntry>;

	private _nextTick: number | null = null;
	private _nextTickTimer: number | null = null;

	constructor(priorities: TPriorities) {
		const parsedPriorities = new Map<string, PriorityEntry>();

		let lastPriority = 0;
		for (const [key, delay] of Object.entries(priorities)) {
			Assert(delay >= lastPriority, 'Decreasing priorities should have non-decreasing delays');
			lastPriority = delay;

			parsedPriorities.set(key, {
				delay,
				queue: [],
			});
		}

		this._priorities = parsedPriorities;
	}

	public calculate(priority: (keyof TPriorities) & string, fn: () => void): () => void {
		const priorityData = this._priorities.get(priority);
		AssertNotNullable(priorityData);

		// Add into queue
		priorityData.queue.push(fn);

		// Make sure ticker is running
		this._updateTimer();

		// Cancellation function
		return () => {
			// Check if the task is still queued
			const index = priorityData.queue.indexOf(fn);
			if (index < 0)
				return;
			// Dequeue
			priorityData.queue.splice(index, 1);
			// Cleanup if there is nothing left
			if (priorityData.queue.length === 0) {
				this._updateTimer();
			}
		};
	}

	private _doTick(): void {
		for (const priorityData of this._priorities.values()) {
			const fn = priorityData.queue.shift();
			if (fn != null) {
				try {
					fn();
				} finally {
					this._updateTimer();
				}
				return;
			}
		}
	}

	/** Updates the timeout to make sure it will happen after "at most the current hightest priority" time */
	private _updateTimer(): void {
		Assert((this._nextTick == null) === (this._nextTickTimer == null));

		let newTimer: number | null = null;
		const now = Date.now();

		for (const priorityData of this._priorities.values()) {
			if (priorityData.queue.length > 0) {
				newTimer = now + priorityData.delay;
				break;
			}
		}

		if (this._nextTick != null && (newTimer == null || this._nextTick > newTimer)) {
			AssertNotNullable(this._nextTickTimer);
			clearTimeout(this._nextTickTimer);
			this._nextTickTimer = null;
			this._nextTick = null;
		}

		if (newTimer != null && this._nextTickTimer == null) {
			this._nextTick = newTimer;
			this._nextTickTimer = setTimeout(() => {
				this._nextTickTimer = null;
				this._nextTick = null;
				this._doTick();
			}, newTimer - now);
		}
	}
}

export function useCalculateInQueue<const TPriorities extends Readonly<Record<string, number>>>(
	queue: CalculationQueue<TPriorities>,
	priority: (keyof TPriorities) & string,
	fn: () => void,
): void {
	useEffect(() => {
		return queue.calculate(priority, fn);
	}, [queue, priority, fn]);
}
