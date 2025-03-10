import { LIMIT_ITEM_NAME_LENGTH } from 'pandora-common';
import { type ReactElement, useState } from 'react';
import { TextInput } from '../../../../../common/userInteraction/input/textInput';
import { Button } from '../../../../common/button/button.tsx';
import { Column, Row } from '../../../../common/container/container.tsx';
import { ModalDialog } from '../../../../dialog/dialog.tsx';
import { useCharacterState, useGameState, useGlobalState } from '../../../../gameContext/gameStateContextProvider.tsx';
import type { CharacterModifierConditionListEntryProps } from './characterModifierCondition.tsx';

export function ConditionItemWithName({ condition, setCondition, invert, setInvert, processing, character }: CharacterModifierConditionListEntryProps<'hasItemWithName'>): ReactElement {
	const [showDialog, setShowDialog] = useState(false);

	return (
		<span>
			<Button
				onClick={ () => setInvert?.(!invert) }
				disabled={ processing || setInvert == null }
				slim
			>
				{ invert ? 'Is not' : 'Is' }
			</Button>
			{ ' wearing an item named ' }
			<Button
				onClick={ () => setShowDialog(true) }
				slim
				disabled={ setCondition == null }
			>
				{ condition.name || '[not set]' }
			</Button>
			{ showDialog ? (
				<ConditionItemWithNameDialog condition={ condition } setCondition={ setCondition } character={ character } close={ () => setShowDialog(false) } />
			) : null }
		</span>
	);
}

function ConditionItemWithNameDialog({ condition, setCondition, close, character }: Pick<CharacterModifierConditionListEntryProps<'hasItemWithName'>, 'condition' | 'setCondition' | 'character'> & { close: () => void; }): ReactElement {
	const [itemName, setItemName] = useState<string | null>(null);
	const effectiveItemName = itemName ?? condition.name;

	const gameState = useGameState();
	const globalState = useGlobalState(gameState);
	const characterState = useCharacterState(globalState, character.id);

	return (
		<ModalDialog>
			<Column>
				<h2>Select item name</h2>
				<Row alignY='center'>
					<label>Name:</label>
					<TextInput
						className='flex-1'
						value={ effectiveItemName }
						maxLength={ LIMIT_ITEM_NAME_LENGTH }
						onChange={ setItemName } />
				</Row>
				<i>Note: Names must match exactly and are case sensitive. Only custom item names are checked.</i>
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
							if (itemName != null) {
								setCondition?.({
									type: 'hasItemWithName',
									name: itemName,
								});
							}
							close();
						} }
						disabled={ setCondition == null }
					>
						Confirm
					</Button>
				</Row>
				<hr className='fill-x' />
				<fieldset>
					<legend>Quick selection</legend>
					<Column alignX='start'>
						{ characterState?.items.slice().reverse()
							.filter((i) => !!i.name)
							.map((i) => (
								<Button
									key={ i.id }
									slim
									onClick={ () => {
										setCondition?.({
											type: 'hasItemWithName',
											name: i.name ?? '',
										});
										close();
									} }
									disabled={ setCondition == null }
								>
									{ i.name }
								</Button>
							)) }
					</Column>
				</fieldset>
			</Column>
		</ModalDialog>
	);
}
