import type { Immutable } from 'immer';
import { AppearanceActionProcessingContext, FinishActionAttempt, type AssetFrameworkCharacterState, type CharacterActionAttempt } from 'pandora-common';
import React, { ReactElement, useCallback, useMemo } from 'react';
import { Column, Row } from '../../common/container/container';
import { useCheckAddPermissions } from '../../gameContext/permissionCheckProvider';
import { useWardrobeActionContext, useWardrobeExecuteCallback, useWardrobeExecuteChecked } from '../wardrobeActionContext';
import { WardrobeActionButtonElement } from '../wardrobeComponents';
import { useWardrobeContext } from '../wardrobeContext';

export function WardrobeActionAttemptOverlay({ characterState }: {
	characterState: AssetFrameworkCharacterState;
}): ReactElement | null {
	const { player } = useWardrobeActionContext();
	const currentlyAttemptedAction = characterState.attemptingAction;

	if (currentlyAttemptedAction == null)
		return null;

	return (
		<Column padding='medium' className='pointer-events-enable actionAttempt' key={ currentlyAttemptedAction.start }>
			This character is currently attempting an action.
			{
				characterState.id === player.id ? (
					<Row alignX='space-between'>
						<ActionAttemptCancelButton attemptingAction={ currentlyAttemptedAction } />
						<ActionAttemptConfirmButton attemptingAction={ currentlyAttemptedAction } />
					</Row>
				) : (
					<Row alignX='start'>
						<ActionAttemptInterruptButton attemptingAction={ currentlyAttemptedAction } />
					</Row>
				)
			}
		</Column>
	);
}

function ActionAttemptCancelButton({ attemptingAction }: {
	attemptingAction: Immutable<CharacterActionAttempt>;
}): ReactElement {
	const { actions, globalState } = useWardrobeActionContext();
	const { targetSelector } = useWardrobeContext();

	const cancelCheckInitial = useMemo(() => {
		const processingContext = new AppearanceActionProcessingContext(actions, globalState);
		const actionTarget = processingContext.getTarget(targetSelector);
		if (actionTarget == null)
			return processingContext.invalid();

		if (actionTarget.type === 'character') {
			processingContext.checkInteractWithTarget(actionTarget);
		}
		return processingContext.finalize();
	}, [actions, globalState, targetSelector]);

	const checkResult = useCheckAddPermissions(cancelCheckInitial);

	const [execute, processing] = useWardrobeExecuteCallback();

	const cancelAttempt = useCallback(() => {
		execute(attemptingAction.action, 'abort');
	}, [execute, attemptingAction]);

	return (
		<WardrobeActionButtonElement
			check={ checkResult }
			onClick={ cancelAttempt }
			disabled={ processing }
		>
			Cancel
		</WardrobeActionButtonElement>
	);
}

function ActionAttemptConfirmButton({ attemptingAction }: {
	attemptingAction: Immutable<CharacterActionAttempt>;
}): ReactElement {
	const { actions, globalState } = useWardrobeActionContext();

	const checkInitial = useMemo(() => {
		return FinishActionAttempt(actions, globalState, attemptingAction.finishAfter);
	}, [actions, globalState, attemptingAction]);

	const checkResult = useCheckAddPermissions(checkInitial);

	const { execute, processing } = useWardrobeExecuteChecked(attemptingAction.action, checkResult);

	return (
		<WardrobeActionButtonElement
			check={ checkResult }
			currentAttempt={ attemptingAction }
			actionData={ attemptingAction.action }
			onClick={ execute }
			disabled={ processing }
		>
			Complete the action
		</WardrobeActionButtonElement>
	);
}

function ActionAttemptInterruptButton(_props: {
	attemptingAction: Immutable<CharacterActionAttempt>;
}): ReactElement {
	const { actions, globalState } = useWardrobeActionContext();
	const { targetSelector } = useWardrobeContext();

	const cancelCheckInitial = useMemo(() => {
		const processingContext = new AppearanceActionProcessingContext(actions, globalState);
		const actionTarget = processingContext.getTarget(targetSelector);
		if (actionTarget == null)
			return processingContext.invalid();

		if (actionTarget.type === 'character') {
			processingContext.checkInteractWithTarget(actionTarget);
		}

		return processingContext.invalid();
	}, [actions, globalState, targetSelector]);

	const checkResult = useCheckAddPermissions(cancelCheckInitial);

	const [, processing] = useWardrobeExecuteCallback();

	const interruptAttempt = useCallback(() => {
	}, []);

	return (
		<WardrobeActionButtonElement
			check={ checkResult }
			onClick={ interruptAttempt }
			disabled={ processing || true }
		>
			[TODO] Interrupt
		</WardrobeActionButtonElement>
	);
}
