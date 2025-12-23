import type { Immutable } from 'immer';
import { sortBy } from 'lodash-es';
import { AssertNotNullable, EMPTY_ARRAY, type AssetFrameworkCharacterState, type AssetFrameworkGlobalState, type CharacterActionAttempt, type ICharacterRoomData, type SpaceId } from 'pandora-common';
import { useMemo, type ReactElement } from 'react';
import type { Character } from '../../../character/character.ts';
import type { PlayerCharacter } from '../../../character/player.ts';
import { Column, Row } from '../../../components/common/container/container.tsx';
import type { GameState } from '../../../components/gameContext/gameStateContextProvider.tsx';
import { usePlayer } from '../../../components/gameContext/playerContextProvider.tsx';
import { ActionAttemptCancelButton, ActionAttemptConfirmButton, ActionAttemptInterruptButton } from '../../../components/wardrobe/views/wardrobeActionAttempt.tsx';
import { useObservable } from '../../../observable.ts';
import { useGlobalState } from '../../../services/gameLogic/gameStateHooks.ts';
import { SpaceOwnershipInvitationConfirm } from '../../screens/spaceConfiguration/spaceOwnershipInvite.tsx';
import { ActionMessageElement } from './chatMessage.tsx';
import { DescribeGameLogicAction } from './chatMessagesDescriptions.tsx';

interface ChatInjectedMessageDescriptor {
	time: number;
	element: ReactElement;
}

export function useChatInjectedMessages(gameState: GameState): readonly ChatInjectedMessageDescriptor[] {
	const currentSpace = useObservable(gameState.currentSpace);
	const currentState = useGlobalState(gameState);
	const characters = useObservable(gameState.characters);
	const player = usePlayer();
	AssertNotNullable(player);

	return useMemo((): readonly ChatInjectedMessageDescriptor[] => {
		const result: ChatInjectedMessageDescriptor[] = [];

		// Struggling messages
		for (const character of characters) {
			const characterState = currentState.getCharacterState(character.id);
			if (characterState?.attemptingAction != null) {
				result.push(MessageForAttemptedAction(character, characterState, currentState, player, characterState.attemptingAction));
			}
		}

		// Space ownership invitation
		if (currentSpace.id != null && currentSpace.config.ownerInvites.includes(player.data.accountId)) {
			result.push(MessageForSpaceOwnershipInvitation(currentSpace.id));
		}

		// Most likely scenario: Nothing to show
		// Optimize this by always returning same reference, so the update does not cause message list update
		if (result.length === 0)
			return EMPTY_ARRAY;

		return sortBy(result, (m) => m.time);
	}, [currentSpace, currentState, characters, player]);
}

function MessageForAttemptedAction(
	character: Character<ICharacterRoomData>,
	characterState: AssetFrameworkCharacterState,
	globalState: AssetFrameworkGlobalState,
	player: PlayerCharacter,
	action: Immutable<CharacterActionAttempt>,
): ChatInjectedMessageDescriptor {
	const playerState = globalState.getCharacterState(player.id);

	return {
		time: action.start,
		element: (
			<ActionMessageElement
				key={ `actionAttempt-${character.id}-${action.start}` }
				type='serverMessage'
				messageTime={ action.start }
				edited={ false }
				dim={ playerState != null && playerState.currentRoom !== characterState.currentRoom }
				rooms={ [{
					id: characterState.currentRoom,
					name: globalState.space.getRoom(characterState.currentRoom)?.displayName ?? characterState.currentRoom,
				}] }
				receivedRoomId={ playerState?.currentRoom ?? characterState.currentRoom }
				extraContent={
					<Column>
						<span>
							{ character.isPlayer() ? 'You are' : `${ character.data.name } (${ character.id }) is` } attempting to:&#32;
							<DescribeGameLogicAction
								action={ action.action }
								actionOriginator={ character }
								globalState={ globalState }
							/>
						</span>
						{
							character.isPlayer() ? (
								<Row padding='medium'>
									<ActionAttemptCancelButton attemptingAction={ action } />
									<ActionAttemptConfirmButton attemptingAction={ action } />
								</Row>
							) : (
								<Row padding='medium'>
									<ActionAttemptInterruptButton characterState={ characterState } attemptingAction={ action } />
								</Row>
							)
						}
					</Column>
				}
				defaultUnfolded
			>
				{ character.isPlayer() ? 'You are' : `${ character.data.name } (${ character.id }) is` } attempting an action.
			</ActionMessageElement>
		),
	};
}

function MessageForSpaceOwnershipInvitation(
	spaceId: SpaceId,
): ChatInjectedMessageDescriptor {
	return {
		time: Infinity,
		element: (
			<ActionMessageElement
				key={ `spaceOwnershipInvitation` }
				type='serverMessage'
				messageTime={ null }
				edited={ false }
				rooms={ null }
				receivedRoomId={ null }
				extraContent={
					<SpaceOwnershipInvitationConfirm
						spaceId={ spaceId }
					/>
				}
				defaultUnfolded
			>
				Space ownership invitation
			</ActionMessageElement>
		),
	};
}
