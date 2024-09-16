import {
	AppearanceAction,
	AppearanceActionContext,
	AppearanceActionProcessingResult,
	DoAppearanceAction,
} from 'pandora-common';
import { useCallback, useRef, useState } from 'react';
import { CalculationQueue, useCalculateInQueue } from '../../common/calculationQueue';
import { useCheckAddPermissions } from '../gameContext/permissionCheckProvider';
import { useWardrobeActionContext } from './wardrobeActionContext';

const calculationQueue = new CalculationQueue({
	immediate: 0,
	normal: 0,
	low: 50,
});

export function useStaggeredAppearanceActionResult(action: AppearanceAction | null, { lowPriority = false, immediate = false }: { lowPriority?: boolean; immediate?: boolean; } = {}): AppearanceActionProcessingResult | null {
	const { actions, globalState } = useWardrobeActionContext();
	const [result, setResult] = useState<AppearanceActionProcessingResult | null>(null);

	const resultAction = useRef<AppearanceAction | null>(null);
	const resultContext = useRef<AppearanceActionContext | null>(null);

	const wantedAction = useRef(action);
	const wantedContext = useRef(actions);

	wantedAction.current = action;
	wantedContext.current = actions;

	const calculate = useCallback(() => {
		if (wantedAction.current === action && wantedContext.current === actions) {
			if (action == null) {
				resultAction.current = null;
				resultContext.current = null;
				setResult(null);
			} else {
				const checkResult = DoAppearanceAction(action, actions, globalState);
				resultAction.current = action;
				resultContext.current = actions;
				setResult(checkResult);
			}
		}
	}, [action, actions, globalState]);

	useCalculateInQueue(calculationQueue, immediate ? 'immediate' : lowPriority ? 'low' : 'normal', calculate);

	const valid = lowPriority ? (resultAction.current === action && resultContext.current === actions) :
		(resultAction.current?.type === action?.type);

	return useCheckAddPermissions(valid ? result : null);
}
