import {
	AppearanceAction,
	AppearanceActionContext,
	AppearanceActionProcessingResult,
	DoAppearanceAction,
} from 'pandora-common';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useWardrobeContext } from './wardrobeContext';
import { CalculationQueue, useCalculateInQueue } from '../../common/calculationQueue';
import { usePermissionCheck } from '../gameContext/permissionCheckProvider';

const calculationQueue = new CalculationQueue({
	immediate: 0,
	normal: 0,
	low: 50,
});

export function useStaggeredAppearanceActionResult(action: AppearanceAction | null, { lowPriority = false, immediate = false }: { lowPriority?: boolean; immediate?: boolean; } = {}): AppearanceActionProcessingResult | null {
	const { actions, globalState } = useWardrobeContext();
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
				const checkResult = DoAppearanceAction(action, actions, globalState.assetManager);
				resultAction.current = action;
				resultContext.current = actions;
				setResult(checkResult);
			}
		}
	// Note, the presence of `globalState` here is more important than just for assetManager
	// Its purpose is to recalculate requirements when the state changes
	}, [action, actions, globalState]);

	useCalculateInQueue(calculationQueue, immediate ? 'immediate' : lowPriority ? 'low' : 'normal', calculate);

	const valid = lowPriority ? (resultAction.current === action && resultContext.current === actions) :
		(resultAction.current?.type === action?.type);

	const permissionProblems = usePermissionCheck(result?.requiredPermissions);

	return useMemo((): AppearanceActionProcessingResult | null => {
		if (!valid || result == null)
			return null;

		if (permissionProblems.length > 0) {
			return result.addAdditionalProblems(permissionProblems);
		}

		return result;
	}, [valid, result, permissionProblems]);
}
