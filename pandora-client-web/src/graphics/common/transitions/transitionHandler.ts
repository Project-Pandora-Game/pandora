import { clamp } from 'lodash-es';
import { Assert } from 'pandora-common';
import type { TransitionTimingFunction } from './transitionTimingFunctions.ts';

/*
This graphical transitions framework is based on the CSS Transitions
https://drafts.csswg.org/css-transitions/

While it definitely cannot be called "Spec-compliant", there was an attempt to make it match quite closely.
The handler, however, implements only a single-property transition.
To transition multiple properties at the same time, multiple transition handlers with matching settings need to be used.
*/

export type TransitionHandlerValueProcessor<TValue> = {
	/** Creates a mix of the two values for this type. */
	mix: (a: TValue, b: TValue, ratio: number) => TValue;
	/** Checks whether a transition can occur */
	isTransitionable: (a: TValue, b: TValue) => boolean;
};

export const TRANSITION_PROCESSOR_NUMBER: Readonly<TransitionHandlerValueProcessor<number>> = {
	mix(a, b, ratio) {
		return (1 - ratio) * a + ratio * b;
	},
	isTransitionable(a, b) {
		return Number.isFinite(a) && Number.isFinite(b);
	},
};

export function MakeTransitionProcessorNumberWithModulo(modulo: number): Readonly<TransitionHandlerValueProcessor<number>> {
	return {
		mix(a, b, ratio) {
			a %= modulo;
			b %= modulo;
			const diff = Math.abs(a - b);
			// If it is smaller distance to wrap around, then do that
			if ((Math.abs(a + modulo - b) < diff)) {
				a += modulo;
			} else if ((Math.abs(a - (b + modulo)) < diff)) {
				b += modulo;
			}
			return ((1 - ratio) * a + ratio * b) % modulo;
		},
		isTransitionable(a, b) {
			return Number.isFinite(a) && Number.isFinite(b);
		},
	};
}

export interface TransitionHandlerProps<TValue> {
	/** Duration of the transition, in ms */
	transitionDuration: number;
	/**
	 * Delay before the transition should start, in ms
	 * @default 0
	 */
	transitionDelay?: number;
	/**
	 * A timing function to use for the transition.
	 * @see TransitionTimingFunction
	 * @default TRANSITION_TIMING_LINEAR
	 */
	transitionTimingFunction?: TransitionTimingFunction;

	valueProcessor: Readonly<TransitionHandlerValueProcessor<TValue>>;

	/**
	 * Application function for the new value
	 * @param newValue - The value that should be applied
	 */
	applyValue: (newValue: TValue) => void;
}

type RunningTransition<TValue> = {
	state: 'running' | 'completed';

	startTime: number;
	endTime: number;
	startValue: TValue;
	endValue: TValue;

	reversingAdjustedStartValue: TValue;
	reversingShorteningFactor: number;
};

export class TransitionHandler<TValue> {
	public readonly config: Readonly<TransitionHandlerProps<TValue>>;
	public readonly combinedDuration: number;

	/** The current value that should be displayed. */
	private _currentValue: TValue;
	/** The value that is currently targetted. */
	private _targetValue: TValue;
	/** targetValue as soon as there is a tick (after-change style; used to determinate before-change style on tick) */
	private _appliedTargetValue: TValue;

	private _currentTransition: RunningTransition<TValue> | null = null;

	public get currentValue(): TValue {
		return this._currentValue;
	}

	private _needsUpdate: boolean = false;

	public get needsUpdate(): boolean {
		return this._needsUpdate;
	}

	constructor(config: Readonly<TransitionHandlerProps<TValue>>, initialValue: TValue) {
		Object.freeze(config);
		this.config = config;
		this._currentValue = initialValue;
		this._targetValue = initialValue;
		this._appliedTargetValue = initialValue;

		// Check validity
		Assert(Number.isFinite(config.transitionDuration) && config.transitionDuration >= 0, 'Transition duration must be non-negative number.');
		Assert(config.transitionDelay === undefined || Number.isFinite(config.transitionDelay), 'Transition delay must be a number.');

		this.combinedDuration = config.transitionDuration + (config.transitionDelay ?? 0);

		// Do a first application immediately
		this.config.applyValue(this._currentValue);
	}

	/** Sets a target value, triggering a transition at the next tick. */
	public setValue(newValue: TValue): void {
		this._targetValue = newValue;
		// We do not set the appliedTargetValue, so next tick will trigger transition start
		this._needsUpdate = true;
	}

	/** Sets a target value without trigerring a transition, updating directly at the next tick. */
	public setValueImmediate(newValue: TValue): void {
		this._targetValue = newValue;
		// We do set the appliedTargetValue, so next tick will only update the current value and not start a transition
		this._appliedTargetValue = newValue;
		this._needsUpdate = true;
	}

	/** Cancels the current or pending transition. */
	public cancel(): void {
		this._currentTransition = null;
		this._appliedTargetValue = this._targetValue;
		this._needsUpdate = true;
	}

	/**
	 * Updates the transitions state based on the passed time.
	 * @param time - The time in ms on which transition state should be based.
	 */
	public tick(time: number): void {
		const oldValue = this._currentValue;

		// Handle target value changing
		if (this._targetValue !== this._appliedTargetValue) {
			// Tick old transition before style change
			// See section "Completion of transitions" for as to why
			this._tickTransition(time);
			this._handleStyleChange(time);
			this._appliedTargetValue = this._targetValue;
		}
		// Tick the current transition
		this._tickTransition(time);

		// Apply the new value, if it changed
		if (oldValue !== this._currentValue) {
			this.config.applyValue(this._currentValue);
		}

		this._needsUpdate = this._currentTransition?.state === 'running';
	}

	private _calculateTiming(time: number): number {
		Assert(this._currentTransition?.state === 'running');
		const base = (time - this._currentTransition.startTime) / (this._currentTransition.endTime - this._currentTransition.startTime);
		if (base <= 0)
			return 0;
		if (base >= 1)
			return 1;

		return (this.config.transitionTimingFunction?.(base)) ?? base;
	}

	private _tickTransition(time: number): void {
		if (this._currentTransition?.state === 'running') {
			// First handle completion
			if (time >= this._currentTransition.endTime) {
				this._currentValue = this._currentTransition.endValue;
				this._currentTransition.state = 'completed';
			} else {
				// If the transition didn't complete, calculate current value
				if (time < this._currentTransition.startTime) {
					this._currentValue = this._currentTransition.startValue;
				} else {
					this._currentValue = this.config.valueProcessor.mix(
						this._currentTransition.startValue,
						this._currentTransition.endValue,
						this._calculateTiming(time),
					);
				}
			}
		} else {
			// No transition running
			this._currentValue = this._appliedTargetValue;
		}
	}

	private _handleStyleChange(time: number): void {
		// See https://drafts.csswg.org/css-transitions/#starting

		const beforeChangeStyle = this._appliedTargetValue;
		const afterChangeStyle = this._targetValue;

		if ( // 1
			// the element does not have a running transition for the property
			(this._currentTransition?.state !== 'running') &&
			// the before-change style is different from the after-change style for that property, and the values for the property are transitionable
			(beforeChangeStyle !== afterChangeStyle && this.config.valueProcessor.isTransitionable(beforeChangeStyle, afterChangeStyle)) &&
			// the element does not have a completed transition for the property or the end value of the completed transition is different from the after-change style for the property
			(this._currentTransition?.state !== 'completed' || this._currentTransition.endValue !== afterChangeStyle) &&
			// there is a matching transition-property value
			// -> implied by this handler existing
			// the combined duration is greater than 0s
			(this.combinedDuration > 0)
		) {
			const startTime = time + (this.config.transitionDelay ?? 0);

			this._currentTransition = {
				state: 'running',
				startTime,
				endTime: startTime + this.config.transitionDuration,
				startValue: beforeChangeStyle,
				endValue: afterChangeStyle,
				reversingAdjustedStartValue: beforeChangeStyle,
				reversingShorteningFactor: 1,
			};
		} else if ( // 2
			// Otherwise, if the element has a completed transition for the property
			this._currentTransition?.state === 'completed' &&
			// and the end value of the completed transition is different from the after-change style for the property
			this._currentTransition.endValue !== afterChangeStyle
		) {
			// then implementations must remove the completed transition from the set of completed transitions.
			this._currentTransition = null;
		}

		// 3 doesn't apply as the transition property cannot change in our implementation

		// 4
		if (
			// If the element has a running transition for the property
			this._currentTransition?.state === 'running' &&
			// there is a matching transition-property value
			// -> implied
			// and the end value of the running transition is not equal to the value of the property in the after-change style
			this._currentTransition.endValue !== afterChangeStyle
		) {
			if (
				// (1) If the current value of the property in the running transition is equal to the value of the property in the after-change style
				this._currentValue === afterChangeStyle ||
				// or if these two values are not transitionable
				!this.config.valueProcessor.isTransitionable(this._currentValue, afterChangeStyle) ||
				// (2) Otherwise, if the combined duration is less than or equal to 0s ... (same result)
				this.combinedDuration <= 0
			) {
				// then implementations must cancel the running transition
				this._currentTransition = null;
			} else if (
				// (3) Otherwise, if the reversing-adjusted start value of the running transition is the same as the value of the property in the after-change style
				this._currentTransition.reversingAdjustedStartValue === afterChangeStyle
			) {
				// implementations must cancel the running transition and start a new transition ...
				const transitionDelay = this.config.transitionDelay ?? 0;
				const reversingShorteningFactor = clamp(Math.abs(
					(this._calculateTiming(time) * this._currentTransition.reversingShorteningFactor) +
					(1 - this._currentTransition.reversingShorteningFactor),
				), 0, 1);
				const startTime = time + (transitionDelay >= 0 ? transitionDelay : (reversingShorteningFactor * transitionDelay));

				this._currentTransition = {
					state: 'running',
					reversingAdjustedStartValue: this._currentTransition.endValue,
					reversingShorteningFactor,
					startTime,
					endTime: startTime + this.config.transitionDuration * reversingShorteningFactor,
					startValue: this._currentValue,
					endValue: afterChangeStyle,
				};
			} else {
				// Otherwise, implementations must cancel the running transition and start a new transition ...
				const transitionDelay = this.config.transitionDelay ?? 0;
				const startTime = time + transitionDelay;

				this._currentTransition = {
					state: 'running',
					startTime,
					endTime: startTime + this.config.transitionDuration,
					startValue: this._currentValue,
					endValue: afterChangeStyle,
					reversingAdjustedStartValue: this._currentValue,
					reversingShorteningFactor: 1,
				};
			}
		}
	}
}
