import { CharacterIdSchema, CompareCharacterIds, GetLogger, type CharacterId } from 'pandora-common';
import type { ReactElement } from 'react';
import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';
import type { Promisable } from 'type-fest';
import crossIcon from '../../../assets/icons/cross.svg';
import { useAsyncEvent } from '../../../common/useEvent';
import { TextInput } from '../../../common/userInteraction/input/textInput';
import { TOAST_OPTIONS_ERROR } from '../../../persistentToast';
import { Button, IconButton } from '../../common/button/button';
import { Column, Row } from '../../common/container/container';
import { ModalDialog } from '../../dialog/dialog';
import { useResolveCharacterName, useSpaceCharacters } from '../../gameContext/gameStateContextProvider';

export function CharacterListInput({ value, max, onChange }: {
	value: readonly CharacterId[];
	max?: number;
	onChange?: (newValue: readonly CharacterId[]) => Promisable<void>;
}): ReactElement {
	const [showDialog, setShowDialog] = useState(false);

	const [execute, processing] = useAsyncEvent(async (newValue: readonly CharacterId[]) => {
		if (onChange == null)
			throw new Error('Changing value not supported');

		await onChange(newValue);
	}, () => {
		// Close the input dialog after the change
		setShowDialog(false);
	}, {
		errorHandler: (err) => {
			GetLogger('CharacterListInput').error('Failed to configure character modifier:', err);
			toast('Error performing action, try again later', TOAST_OPTIONS_ERROR);
		},
	});

	return (
		<Column gap='medium'>
			<Column padding='small' gap='small' overflowY='auto' className='characterModifierCharacterList'>
				{
					value.length > 0 ? (
						value.map((c) => (
							<CharacterListItem
								key={ c }
								id={ c }
								remove={ onChange != null ? (() => {
									execute(value.filter((i) => i !== c));
								}) : undefined }
								disabledRemove={ processing }
							/>
						))
					) : (
						<span>[ Empty ]</span>
					)
				}
			</Column>
			{
				onChange != null ? (
					<Row alignX='space-between' alignY='center'>
						<Button
							onClick={ () => {
								setShowDialog(true);
							} }
							disabled={ processing || (max != null && value.length >= max) }
							slim
						>
							Add a character
						</Button>
						{
							max != null ? (
								<span>( { value.length } / { max } )</span>
							) : null
						}
					</Row>
				) : null
			}
			{
				(onChange != null && showDialog) ? (
					<CharacterListQuickSelectDialog
						value={ value }
						execute={ execute }
						processing={ processing }
						close={ () => {
							setShowDialog(false);
						} }
					/>
				) : null
			}
		</Column>
	);
}

function CharacterListItem({ id, remove, disabledRemove }: {
	id: CharacterId;
	remove?: () => void;
	disabledRemove?: boolean;
}): ReactElement {
	const characters = useSpaceCharacters();
	const character = characters.find((c) => c.id === id);

	return (
		<Row alignY='center' padding='small' className='listItem'>
			<span className='flex-1'>
				{ useResolveCharacterName(id) ?? '[unknown]' } ({ id }) { character?.isPlayer() ? '[You]' : '' }
			</span>
			{
				remove != null ? (
					<IconButton
						src={ crossIcon }
						alt='Remove entry'
						onClick={ remove }
						slim
						disabled={ disabledRemove }
					/>
				) : null
			}
		</Row>
	);
}

function CharacterListQuickSelectDialog({ value, execute, processing, close }: {
	value: readonly CharacterId[];
	execute: (newValue: readonly CharacterId[]) => void;
	processing: boolean;
	close: () => void;
}): ReactElement {
	const [dialogCharacterId, setDialogCharacterId] = useState<CharacterId | null>(null);

	const spaceCharacters = useSpaceCharacters().slice().sort((a, b) => {
		if (a.isPlayer() !== b.isPlayer()) {
			return a.isPlayer() ? -1 : 1;
		}

		return a.name.localeCompare(b.name);
	});

	const resolvedName = useResolveCharacterName(dialogCharacterId ?? 'c0') ?? '[unknown]';

	const addCharacter = useCallback((c: CharacterId) => {
		if (execute == null)
			return;

		if (value.includes(c)) {
			close();
			return;
		}

		execute([...value, c].sort(CompareCharacterIds));
	}, [execute, value, close]);

	return (
		<ModalDialog>
			<Column>
				<h2>Select character</h2>
				<Row alignY='center'>
					<label>Name:</label>
					<span>{ dialogCharacterId == null ? '...' : resolvedName }</span>
				</Row>
				<Row alignY='center'>
					<label>Id:</label>
					<TextInput
						className='flex-1'
						value={ dialogCharacterId ?? '' }
						onChange={ (newValue) => {
							const parsedInputValue = CharacterIdSchema.safeParse(/^[0-9]+$/.test(newValue) ? `c${newValue}` : newValue);
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
								addCharacter(dialogCharacterId);
							}
						} }
						disabled={ processing }
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
									addCharacter(c.id);
								} }
								disabled={ processing || value.includes(c.id) }
							>
								{ c.name } ({ c.id })  { c.isPlayer() ? '[You]' : '' }  { value.includes(c.id) ? '[Already in the list]' : '' }
							</Button>
						)) }
					</Column>
				</fieldset>
			</Column>
		</ModalDialog>
	);
}
