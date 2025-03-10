import type { Immutable } from 'immer';
import { AppearanceActionProcessingContext, FinishActionAttempt, type AppearanceAction, type AssetFrameworkCharacterState, type CharacterActionAttempt } from 'pandora-common';
import { ReactElement, useCallback, useMemo } from 'react';
import type { IChatroomCharacter } from '../../../character/character.ts';
import { DescribeGameLogicAction } from '../../../ui/components/chat/chatMessagesDescriptions.tsx';
import { Column, Row } from '../../common/container/container.tsx';
import { useCheckAddPermissions } from '../../gameContext/permissionCheckProvider.tsx';
import { useWardrobeActionContext, useWardrobeExecuteCallback, useWardrobeExecuteChecked } from '../wardrobeActionContext.tsx';
import { GameLogicActionButton, WardrobeActionButtonElement } from '../wardrobeComponents.tsx';

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
			<strong>This character is currently attempting an action.</strong>
			<span>
				This character is attempting to: <DescribeGameLogicAction
					action={ currentlyAttemptedAction.action }
					actionOriginator={ character }
					globalState={ globalState }
				/>
			</span>
			{
				characterState.id === player.id ? (
					<Row alignX='space-between'>
						<ActionAttemptCancelButton attemptingAction={ currentlyAttemptedAction } />
						<ActionAttemptConfirmButton attemptingAction={ currentlyAttemptedAction } />
					</Row>
				) : (
					<Row alignX='start'>
						<ActionAttemptInterruptButton characterState={ characterState } attemptingAction={ currentlyAttemptedAction } />
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

export function ActionAttemptInterruptButton({ characterState, attemptingAction }: {
	characterState: AssetFrameworkCharacterState;
	attemptingAction: Immutable<CharacterActionAttempt>;
}): ReactElement {
	const interruptAction = useMemo((): AppearanceAction => ({
		type: 'actionAttemptInterrupt',
		target: {
			type: 'character',
			characterId: characterState.id,
		},
		targetAttemptStart: attemptingAction.start,
	}), [characterState.id, attemptingAction.start]);

	return (
		<GameLogicActionButton
			action={ interruptAction }
		>
			Interrupt the attempt
		</GameLogicActionButton>
	);
}
