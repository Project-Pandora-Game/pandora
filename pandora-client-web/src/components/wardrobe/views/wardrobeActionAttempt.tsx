import type { Immutable } from 'immer';
import { AppearanceActionProcessingContext, FinishActionAttempt, type AppearanceAction, type AssetFrameworkCharacterState, type CharacterActionAttempt } from 'pandora-common';
import React, { ReactElement, useCallback, useMemo } from 'react';
import type { IChatroomCharacter } from '../../../character/character';
import { Column, Row } from '../../common/container/container';
import { useCheckAddPermissions } from '../../gameContext/permissionCheckProvider';
import { useWardrobeActionContext, useWardrobeExecuteCallback, useWardrobeExecuteChecked } from '../wardrobeActionContext';
import { GameLogicActionButton, WardrobeActionButtonElement } from '../wardrobeComponents';

export function WardrobeActionAttemptOverlay({ character }: {
	character: IChatroomCharacter;
}): ReactElement | null {
	const { player, globalState } = useWardrobeActionContext();
	const characterState = globalState.characters.get(character.id);
	const currentlyAttemptedAction = characterState?.attemptingAction;

	if (characterState == null || currentlyAttemptedAction == null)
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
						<ActionAttemptInterruptButton characterState={ characterState } />
					</Row>
				)
			}
		</Column>
	);
}

export function ActionAttemptCancelButton({ attemptingAction }: {
	attemptingAction: Immutable<CharacterActionAttempt>;
}): ReactElement {
	const { actions, globalState } = useWardrobeActionContext();

	const cancelCheckInitial = useMemo(() => {
		const processingContext = new AppearanceActionProcessingContext(actions, globalState);
		return processingContext.finalize();
	}, [actions, globalState]);

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
			Stop the attempt
		</WardrobeActionButtonElement>
	);
}

export function ActionAttemptConfirmButton({ attemptingAction }: {
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

export function ActionAttemptInterruptButton({ characterState }: {
	characterState: AssetFrameworkCharacterState;
}): ReactElement {
	const interruptAction = useMemo((): AppearanceAction => ({
		type: 'actionAttemptInterrupt',
		target: {
			type: 'character',
			characterId: characterState.id,
		},
	}), [characterState.id]);

	return (
		<GameLogicActionButton
			action={ interruptAction }
		>
			Interrupt the attempt
		</GameLogicActionButton>
	);
}
