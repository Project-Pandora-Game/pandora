import { type CharacterId, CharacterIdSchema } from 'pandora-common';
import { type ReactElement, useState } from 'react';
import { TextInput } from '../../../../../common/userInteraction/input/textInput';
import { useResolveCharacterName, useSpaceCharacters } from '../../../../../services/gameLogic/gameStateHooks.ts';
import { Button } from '../../../../common/button/button.tsx';
import { Column, Row } from '../../../../common/container/container.tsx';
import { ModalDialog } from '../../../../dialog/dialog.tsx';
import type { CharacterModifierConditionListEntryProps } from './characterModifierCondition.tsx';

export function ConditionCharacterPresent({ condition, setCondition, invert, setInvert, processing }: CharacterModifierConditionListEntryProps<'characterPresent'>): ReactElement {
	const [showDialog, setShowDialog] = useState(false);

	const resolvedName = useResolveCharacterName(condition.characterId) ?? '[unknown]';

	return (
		<span>
			<Button
				onClick={ () => setInvert?.(!invert) }
				disabled={ processing || setInvert == null }
				slim
			>
				{ invert ? 'Not in' : 'In' }
			</Button>
			{ ' the same space as character ' }
			<Button
				onClick={ () => setShowDialog(true) }
				slim
				disabled={ setCondition == null }
			>
				{ condition.characterId === 'c0' ? '[not set]' : `${resolvedName} (${ condition.characterId })` }
			</Button>
			{ showDialog ? (
				<ConditionCharacterPresentDialog condition={ condition } setCondition={ setCondition } close={ () => setShowDialog(false) } />
			) : null }
		</span>
	);
}

function ConditionCharacterPresentDialog({ condition, setCondition, close }: Pick<CharacterModifierConditionListEntryProps<'characterPresent'>, 'condition' | 'setCondition'> & { close: () => void; }): ReactElement {
	const [dialogCharacterId, setDialogCharacterId] = useState<CharacterId | null>(null);

	const spaceCharacters = useSpaceCharacters().slice().sort((a, b) => {
		if (a.isPlayer() !== b.isPlayer()) {
			return a.isPlayer() ? -1 : 1;
		}

		return a.name.localeCompare(b.name);
	});

	const effectiveId = dialogCharacterId ?? condition.characterId;
	const resolvedName = useResolveCharacterName(effectiveId) ?? '[unknown]';

	return (
		<ModalDialog>
			<Column>
				<h2>Select character</h2>
				<Row alignY='center'>
					<label>Name:</label>
					<span>{ effectiveId === 'c0' ? '[not set]' : resolvedName }</span>
				</Row>
				<Row alignY='center'>
					<label>Id:</label>
					<TextInput
						className='flex-1'
						value={ effectiveId === 'c0' ? '' : effectiveId }
						placeholder={ condition.characterId }
						onChange={ (value) => {
							const parsedInputValue = CharacterIdSchema.safeParse(/^[0-9]+$/.test(value) ? `c${value}` : value);
							if (parsedInputValue.success) {
								setDialogCharacterId(parsedInputValue.data);
							}
						} } />
				</Row>
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
							if (dialogCharacterId != null) {
								setCondition?.({
									type: 'characterPresent',
									characterId: dialogCharacterId,
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
						{ spaceCharacters.map((c) => (
							<Button
								key={ c.id }
								slim
								onClick={ () => {
									setCondition?.({
										type: 'characterPresent',
										characterId: c.id,
									});
									close();
								} }
								disabled={ setCondition == null }
							>
								{ c.name } ({ c.id })  { c.isPlayer() ? '[You]' : '' }
							</Button>
						)) }
					</Column>
				</fieldset>
			</Column>
		</ModalDialog>
	);
}
