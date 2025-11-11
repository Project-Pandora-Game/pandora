import { CreateManuallyResolvedPromise, type Promisable } from 'pandora-common';

/** Sleep for certain amount of milliseconds */
export function Sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Provides a mechanism for running asynchronous tasks at fixed intervals, similar to `setInterval` but with additional control and safety features.
 * This class ensures that the asynchronous task does not run multiple times concurrently, and it allows for flexible management of the task execution with start, stop, and immediate execution capabilities.
 */
export class AsyncInterval {
	private readonly task: () => Promisable<void>;
	private readonly interval: number;
	private readonly errorHandler: (error: unknown) => void;
	private intervalId: NodeJS.Timeout | null = null;
	private immediatePromise: Promise<void> | null = null;
	private executingPromise: Promise<void> | null = null;
	private shouldScheduleNext = false;

	/**
	 * Creates an instance of AsyncInterval.
	 * @param task The asynchronous task to be executed at fixed intervals.
	 * @param interval The interval in milliseconds between executions of the task.
	 * @param errorHandler A callback function that handles errors thrown during the execution of the task.
	 */
	constructor(task: () => Promisable<void>, interval: number, errorHandler: (error: unknown) => void) {
		this.task = task;
		this.interval = interval;
		this.errorHandler = errorHandler;
	}

	/**
	 * Starts the execution of the asynchronous task at the specified interval.
	 * If the task is already running, calling this method has no effect.
	 * @returns The instance of AsyncInterval for chaining.
	 */
	public start(): this {
		if (this.intervalId == null) {
			this.shouldScheduleNext = false;
			this.intervalId = setInterval(() => this.runOnInterval(), this.interval).unref();
			this.runOnInterval();
		}
		return this;
	}

	/**
	 * Stops the execution of the asynchronous task.
	 * If the task is not currently running, calling this method has no effect.
	 * @returns The instance of AsyncInterval for chaining.
	 */
	public stop(): this {
		if (this.intervalId != null) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}
		this.shouldScheduleNext = false;
		return this;
	}

	/**
	 * Executes the task immediately, outside of its regular interval.
	 * If the task is currently executing, this method waits for the current execution to finish before starting a new execution.
	 * This method must be awaited to know when the immediate execution has completed.
	 * @returns A promise that resolves when the immediate execution of the task has completed.
	 */
	public immediate(): Promise<void> {
		if (this.immediatePromise != null) {
			return this.immediatePromise;
		}
		if (this.executingPromise == null) {
			return this.createExecutionPromise();
		}
		const executingPromise = this.executingPromise;
		this.immediatePromise = new Promise<void>((resolve, reject) => {
			executingPromise
				.then(() => {
					this.immediatePromise = null;
					this.createExecutionPromise().then(resolve, reject);
				}, (error) => {
					this.immediatePromise = null;
					// eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
					reject(error);
				});
		});
		return this.immediatePromise;
	}

	private runOnInterval(): void {
		if (this.executingPromise != null) {
			this.shouldScheduleNext = true;
			return;
		}
		this.createExecutionPromise()
			.catch((error) => this.errorHandler(error));
	}

	private createExecutionPromise(): Promise<void> {
		const { promise, resolve, reject } = CreateManuallyResolvedPromise<void>();
		this.executingPromise = promise;
		this.runTask().then(resolve, reject);
		return this.executingPromise;
	}

	private async runTask(): Promise<void> {
		try {
			this.shouldScheduleNext = false;
			await this.task();
		} finally {
			this.executingPromise = null;
			if (this.shouldScheduleNext) {
				this.runOnInterval();
			}
		}
	}
}
