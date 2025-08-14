import { AppearanceActionProcessingContext, ApplyAction, AssertNever, GetLogger, type AppearanceAction } from 'pandora-common';
import { toast } from 'react-toastify';
import { RenderAppearanceActionProblem } from '../../../../assets/appearanceValidation.tsx';
import { Column } from '../../../../components/common/container/container.tsx';
import { OpenConfirmDialog } from '../../../../components/dialog/dialog.tsx';
import { type GameState } from '../../../../components/gameContext/gameStateContextProvider.tsx';
import { ActionWarningContent } from '../../../../components/wardrobe/wardrobeComponents.tsx';
import { WardrobeCheckResultForConfirmationWarnings } from '../../../../components/wardrobe/wardrobeUtils.ts';
import { TOAST_OPTIONS_ERROR, TOAST_OPTIONS_WARNING } from '../../../../persistentToast.ts';

export function CommandDoGameAction(gameState: GameState, action: AppearanceAction): boolean {
	const { currentState } = gameState.globalState;

	const spaceContext = gameState.getCurrentSpaceContext();
	const characters = gameState.characters.value;
	const processingContext = new AppearanceActionProcessingContext({
		executionContext: 'clientOnlyVerify',
		player: gameState.player.gameLogicCharacter,
		spaceContext,
		getCharacter: (id) => {
			const state = currentState.getCharacterState(id);
			const character = characters.find((c) => c.id === id);
			if (!state || !character)
				return null;

			return character.gameLogicCharacter;
		},
	}, currentState);

	const checkResult = ApplyAction(processingContext, action);

	if (!checkResult.valid && checkResult.prompt == null) {
		toast(<ActionWarningContent problems={ checkResult.problems } prompt={ false } />, TOAST_OPTIONS_WARNING);
		return false;
	}

	// Detect need for confirmation
	const warnings = WardrobeCheckResultForConfirmationWarnings(gameState.player, spaceContext, action, checkResult);
	const needsAttempt = checkResult.getActionSlowdownTime() > 0;

	Promise.resolve()
		.then(() => {
			if (warnings.length > 0) {
				return OpenConfirmDialog(
					`You might not be able to undo this action easily. Continue?`,
					(
						<ul>
							{
								warnings.map((warning, i) => <li key={ i }>{ warning }</li>)
							}
						</ul>
					),
				);
			}

			return true;
		})
		.then((confirmResult) => {
			if (!confirmResult)
				return;

			return needsAttempt ? gameState.startActionAttempt(action) :
				gameState.doImmediateAction(action);
		})
		.then((result) => {
			switch (result?.result) {
				case 'success':
				case undefined:
					// Nothing to do
					break;
				case 'promptSent':
					toast('You do not have the necessary permissions to perform this action.\nA permission prompt has been sent to the character.', TOAST_OPTIONS_WARNING);
					break;
				case 'promptFailedCharacterOffline':
					toast('You do not have the necessary permissions to perform this action.\nThe character is offline, try again later.', TOAST_OPTIONS_ERROR);
					break;
				case 'failure':
					GetLogger('CommandDoGameAction').info('Failure executing action:', result.problems);
					toast(
						<Column>
							<span>Problems performing action:</span>
							<ul>
								{
									result.problems.map((problem, i) => (
										<li key={ i } className='display-linebreak'>
											{ RenderAppearanceActionProblem(
												currentState.assetManager,
												problem,
												'custom_with_original_in_brackets', // FIXME: This should use acccount setting wardrobeItemDisplayNameType
											) }
										</li>
									))
								}
							</ul>
						</Column>,
						TOAST_OPTIONS_ERROR,
					);
					break;
				default:
					AssertNever(result);
			}
		})
		.catch((err) => {
			GetLogger('CommandDoGameAction').error('Error executing action:', err);
			toast(`Error performing action`, TOAST_OPTIONS_ERROR);
		});

	return true;
}
