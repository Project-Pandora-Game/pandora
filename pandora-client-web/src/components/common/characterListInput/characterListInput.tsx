import classNames from 'classnames';
import { CharacterIdSchema, CompareCharacterIds, GetLogger, type CharacterId } from 'pandora-common';
import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import type { Promisable } from 'type-fest';
import crossIcon from '../../../assets/icons/cross.svg';
import { useAsyncEvent, useEvent } from '../../../common/useEvent.ts';
import { TextInput } from '../../../common/userInteraction/input/textInput.tsx';
import { TOAST_OPTIONS_ERROR } from '../../../persistentToast.ts';
import { useCurrentAccount } from '../../../services/accountLogic/accountManagerHooks.ts';
import type { SelfSelect } from '../../../ui/components/chat/commandsHelpers.ts';
import { Button, IconButton } from '../../common/button/button.tsx';
import { Column, Row } from '../../common/container/container.tsx';
import { ModalDialog } from '../../dialog/dialog.tsx';
import { useResolveCharacterName, useSpaceCharacters } from '../../gameContext/gameStateContextProvider.tsx';
import './characterListInput.scss';

export interface CharacterListInputProps {
	value: readonly CharacterId[];
	max?: number;
	onChange?: (newValue: readonly CharacterId[]) => Promisable<void>;
	/**
	 * Indicates that all entries should be shown.
	 * @default false
	 */
	noLimitHeight?: boolean;
	/**
	 * Whether selecting own character should be allowed
	 * @default 'any'
	 */
	allowSelf?: SelfSelect;
}

export function CharacterListInput({ value, onChange, ...props }: CharacterListInputProps): ReactElement {

	const onAdd = useEvent((c: CharacterId) => {
		if (value.includes(c))
			return;

		return onChange?.([...value, c].sort(CompareCharacterIds));
	});

	const onRemove = useEvent((c: CharacterId) => {
		if (!value.includes(c))
			return;

		return onChange?.(value.filter((i) => i !== c));
	});

	return (
		<CharacterListInputActions
			{ ...props }
			value={ value }
			onAdd={ onChange != null ? onAdd : undefined }
			onRemove={ onChange != null ? onRemove : undefined }
		/>
	);
}

export type CharacterListInputActionsProps = Omit<CharacterListInputProps, 'onChange'> & {
	onAdd?: (characterToAdd: CharacterId) => Promisable<void>;
	onRemove?: (characterToRemove: CharacterId) => Promisable<void>;
};

export function CharacterListInputActions({
	value,
	max,
	onAdd,
	onRemove,
	noLimitHeight = false,
	allowSelf = 'any',
}: CharacterListInputActionsProps): ReactElement {
	const valueOrdered = useMemo(() => value.slice().sort(CompareCharacterIds), [value]);

	const [showDialog, setShowDialog] = useState(false);

	const [executeAdd, processingAdd] = useAsyncEvent(async (characterToAdd: CharacterId) => {
		if (onAdd == null)
			throw new Error('Adding character not supported');

		await onAdd(characterToAdd);
	}, () => {
		// Close the input dialog after the change
		setShowDialog(false);
	}, {
		errorHandler: (err) => {
			GetLogger('CharacterListInput').error('Failed to add character:', err);
			toast('Error performing action, try again later', TOAST_OPTIONS_ERROR);
		},
	});

	const [executeRemove, processingRemove] = useAsyncEvent(async (characterToRemove: CharacterId) => {
		if (onRemove == null)
			throw new Error('Removing character not supported');

		await onRemove(characterToRemove);
	}, null, {
		errorHandler: (err) => {
			GetLogger('CharacterListInput').error('Failed to remove character:', err);
			toast('Error performing action, try again later', TOAST_OPTIONS_ERROR);
		},
	});

	const processing = processingAdd || processingRemove;

	return (
		<Column gap='medium'>
			<Column padding='small' gap='small' overflowY='auto' className={ classNames('characterListInput', noLimitHeight ? null : 'limitHeight') }>
				{
					value.length > 0 ? (
						valueOrdered.map((c) => (
							<CharacterListItem
								key={ c }
								id={ c }
								remove={ onRemove != null ? (() => {
									executeRemove(c);
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
				onAdd != null ? (
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
				(onAdd != null && showDialog) ? (
					<CharacterListQuickSelectDialog
						value={ value }
						executeAdd={ executeAdd }
						disabled={ processing }
						close={ () => {
							setShowDialog(false);
						} }
						allowSelf={ allowSelf }
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

function CharacterListQuickSelectDialog({ value, executeAdd, disabled, allowSelf, close }: {
	value: readonly CharacterId[];
	executeAdd: (characterToAdd: CharacterId) => void;
	disabled: boolean;
	close: () => void;
	allowSelf: SelfSelect;
}): ReactElement {
	const currentAccount = useCurrentAccount();
	const [dialogCharacterId, setDialogCharacterId] = useState<CharacterId | null>(null);

	const spaceCharacters = useSpaceCharacters().slice().sort((a, b) => {
		if (a.isPlayer() !== b.isPlayer()) {
			return a.isPlayer() ? -1 : 1;
		}

		return a.name.localeCompare(b.name);
	});

	const resolvedName = useResolveCharacterName(dialogCharacterId ?? 'c0') ?? '[unknown]';

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
								executeAdd(dialogCharacterId);
							}
						} }
						disabled={ disabled }
					>
						Confirm
					</Button>
				</Row>
				<hr className='fill-x' />
				<fieldset>
					<legend>Quick selection</legend>
					<Column alignX='start'>
						{
							spaceCharacters
								.filter((c) => allowSelf === 'any' || !c.isPlayer())
								.filter((c) => allowSelf !== 'none' || c.data.accountId !== currentAccount?.id)
								.map((c) => (
									<Button
										key={ c.id }
										slim
										onClick={ () => {
											executeAdd(c.id);
										} }
										disabled={ disabled || value.includes(c.id) }
									>
										{ c.name } ({ c.id })  { c.isPlayer() ? '[You]' : '' }  { value.includes(c.id) ? '[Already in the list]' : '' }
									</Button>
								))
						}
					</Column>
				</fieldset>
			</Column>
		</ModalDialog>
	);
}
