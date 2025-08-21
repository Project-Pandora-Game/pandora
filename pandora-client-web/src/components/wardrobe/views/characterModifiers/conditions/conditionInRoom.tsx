import { RoomNameSchema, type RoomName } from 'pandora-common';
import { useState, type ReactElement } from 'react';
import { TextInput } from '../../../../../common/userInteraction/input/textInput.tsx';
import { Button } from '../../../../common/button/button.tsx';
import { Column, Row } from '../../../../common/container/container.tsx';
import { ModalDialog } from '../../../../dialog/dialog.tsx';
import type { CharacterModifierConditionListEntryProps } from './characterModifierCondition.tsx';
import { useGameState, useGlobalState } from '../../../../gameContext/gameStateContextProvider.tsx';

export function ConditionInRoom({ condition, setCondition, invert, setInvert, processing, character }: CharacterModifierConditionListEntryProps<'inRoom'>): ReactElement {
	const [showDialog, setShowDialog] = useState(false);

	return (
		<span>
			<Button
				onClick={ () => setInvert?.(!invert) }
				disabled={ processing || setInvert == null }
				slim
			>
				{ invert ? 'Not in' : 'In' }
			</Button>
			{ ' room named ' }
			<Button
				onClick={ () => setShowDialog(true) }
				slim
				disabled={ setCondition == null }
			>
				{ condition.room || '[not set]' }
			</Button>
			{ showDialog ? (
				<ConditionInRoomDialog condition={ condition } setCondition={ setCondition } character={ character } close={ () => setShowDialog(false) } />
			) : null }
		</span>
	);
}

function ConditionInRoomDialog({ condition, setCondition, close, character }: Pick<CharacterModifierConditionListEntryProps<'inRoom'>, 'condition' | 'setCondition' | 'character'> & { close: () => void; }): ReactElement {
	const [dialogRoom, setDialogRoom] = useState<RoomName | undefined>(undefined);

	const gameState = useGameState();
	const globalState = useGlobalState(gameState);
	const currentRoom = character.getAppearance(globalState).getCurrentRoom();

	const selectedRoomName = dialogRoom === undefined ? condition.room : dialogRoom;

	return (
		<ModalDialog>
			<Column>
				<h2>Enter room name</h2>
				<Row alignY='center'>
					<label>Name:</label>
					<TextInput
						className='flex-1'
						value={ selectedRoomName ?? '' }
						onChange={ (value) => {
							const parsedInputValue = RoomNameSchema.safeParse(value);
							if (parsedInputValue.success) {
								setDialogRoom(parsedInputValue.data);
							}
						} }
					/>
				</Row>
				<Row alignX='end'>
					<Button
						slim
						onClick={ () => {
							setDialogRoom(currentRoom?.name);
						} }
						disabled={ currentRoom == null || currentRoom.name === '' }
					>
						Set to current room
					</Button>
				</Row>
				<div />
				<Row alignX='space-between'>
					<Button
						onClick={ () => {
							close();
						} }
					>
						Cancel
					</Button>
					<Button
						onClick={ () => {
							if (dialogRoom !== undefined) {
								setCondition?.({
									type: 'inRoom',
									room: dialogRoom,
								});
							}
							close();
						} }
						disabled={ setCondition == null }
					>
						Confirm
					</Button>
				</Row>
			</Column>
		</ModalDialog>
	);
}
