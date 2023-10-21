import {
	AppearanceAction,
	AppearanceActionContext,
	AppearanceActionProcessingResult,
	DoAppearanceAction,
} from 'pandora-common';
import { useEffect, useRef, useState } from 'react';
import _ from 'lodash';
import { useWardrobeContext } from './wardrobeContext';

const calculationQueue: (() => void)[] = [];
const calculationQueueLowPriority: (() => void)[] = [];
const CALCULATION_DELAY = 0;
const CALCULATION_DELAY_LOW_PRIORITY = 50;

function CalculateInQueue(fn: () => void, lowPriority = false): () => void {
	const shouldStart = calculationQueue.length === 0 && calculationQueueLowPriority.length === 0;
	if (lowPriority) {
		calculationQueueLowPriority.push(fn);
	} else {
		calculationQueue.push(fn);
	}

	if (shouldStart) {
		const run = () => {
			const runFn = calculationQueue.shift() ?? calculationQueueLowPriority.shift();
			runFn?.();
			if (calculationQueue.length > 0 || calculationQueueLowPriority.length > 0) {
				setTimeout(run, calculationQueue.length > 0 ? CALCULATION_DELAY : CALCULATION_DELAY_LOW_PRIORITY);
			}
		};
		setTimeout(run, CALCULATION_DELAY);
	}

	return () => {
		if (lowPriority) {
			_.remove(calculationQueueLowPriority, (i) => i === fn);
		} else {
			_.remove(calculationQueue, (i) => i === fn);
		}
	};
}

export function useStaggeredAppearanceActionResult(action: AppearanceAction | null, { lowPriority = false, immediate = false }: { lowPriority?: boolean; immediate?: boolean; } = {}): AppearanceActionProcessingResult | null {
	const { actions, player, target, globalState } = useWardrobeContext();
	const [result, setResult] = useState<AppearanceActionProcessingResult | null>(null);

	const resultAction = useRef<AppearanceAction | null>(null);
	const resultContext = useRef<AppearanceActionContext | null>(null);

	const wantedAction = useRef(action);
	const wantedContext = useRef(actions);

	wantedAction.current = action;
	wantedContext.current = actions;

	useEffect(() => {
		let cancelCalculate: (() => void) | undefined;

		const calculate = () => {
			if (wantedAction.current === action && wantedContext.current === actions) {
				if (action == null) {
					resultAction.current = null;
					resultContext.current = null;
					setResult(null);
				} else {
					const checkResult = DoAppearanceAction(action, actions, globalState.assetManager);
					resultAction.current = action;
					resultContext.current = actions;
					setResult(checkResult);
				}
			}
		};
		if (immediate) {
			calculate();
		} else {
			cancelCalculate = CalculateInQueue(calculate, lowPriority);
		}

		return cancelCalculate;
		// Note, the presence of `globalState` here is more important than just for assetManager
		// Its purpose is to recalculate requirements when the state changes
	}, [action, actions, target, lowPriority, immediate, player, globalState]);

	const valid = lowPriority ? (resultAction.current === action && resultContext.current === actions) :
		(resultAction.current?.type === action?.type);

	return valid ? result : null;
}
