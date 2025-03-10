import { SpaceIdSchema, type SpaceId } from 'pandora-common';
import { useState, type ReactElement } from 'react';
import { Checkbox } from '../../../../../common/userInteraction/checkbox';
import { TextInput } from '../../../../../common/userInteraction/input/textInput';
import { Button } from '../../../../common/button/button.tsx';
import { Column, Row } from '../../../../common/container/container.tsx';
import { ModalDialog } from '../../../../dialog/dialog.tsx';
import { useSpaceInfo } from '../../../../gameContext/gameStateContextProvider.tsx';
import type { CharacterModifierConditionListEntryProps } from './characterModifierCondition.tsx';

export function ConditionInSpaceId({ condition, setCondition, invert, setInvert, processing }: CharacterModifierConditionListEntryProps<'inSpaceId'>): ReactElement {
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
			{ ' ' }
			<Button
				onClick={ () => setShowDialog(true) }
				slim
				disabled={ setCondition == null }
			>
				{ condition.spaceId == null ? 'their personal space' : `space ${condition.spaceId.substring(0, 8)}\u2026` }
			</Button>
			{ showDialog ? (
				<ConditionInSpaceIdDialog condition={ condition } setCondition={ setCondition } close={ () => setShowDialog(false) } />
			) : null }
		</span>
	);
}

function ConditionInSpaceIdDialog({ condition, setCondition, close }: Pick<CharacterModifierConditionListEntryProps<'inSpaceId'>, 'condition' | 'setCondition'> & { close: () => void; }): ReactElement {
	const [dialogSpaceId, setDialogSpaceId] = useState<SpaceId | null | undefined>(undefined);
	const currentSpace = useSpaceInfo();

	const selectedSpace = dialogSpaceId === undefined ? condition.spaceId : dialogSpaceId;

	return (
		<ModalDialog>
			<Column>
				<h2>Select space</h2>
				<label>
					<Checkbox
						onChange={ () => {
							setDialogSpaceId(null);
						} }
						checked={ selectedSpace === null }
						radioButtion
					/>
					Their personal space
				</label>
				<label>
					<Checkbox
						onChange={ () => {
							setDialogSpaceId((s) => s == null ? 's/' : s);
						} }
						checked={ selectedSpace !== null }
						radioButtion
					/>
					Specific space
				</label>
				<Row alignY='center'>
					<label>Id:</label>
					<TextInput
						className='flex-1'
						value={ selectedSpace ?? '' }
						disabled={ selectedSpace == null }
						onChange={ (value) => {
							const parsedInputValue = SpaceIdSchema.safeParse(value);
							if (parsedInputValue.success) {
								setDialogSpaceId(parsedInputValue.data);
							}
						} }
					/>
				</Row>
				<Row alignX='end'>
					<Button
						slim
						onClick={ () => {
							setDialogSpaceId(currentSpace.id);
						} }
						disabled={ selectedSpace == null || currentSpace.id == null }
					>
						Set to current space
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
							if (dialogSpaceId !== undefined) {
								setCondition?.({
									type: 'inSpaceId',
									spaceId: dialogSpaceId,
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
