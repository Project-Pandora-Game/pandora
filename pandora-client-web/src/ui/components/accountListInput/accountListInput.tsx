import classNames from 'classnames';
import { AccountIdSchema, Assert, CompareAccountIds, GetLogger, type AccountId, type ICharacterRoomData } from 'pandora-common';
import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import type { Promisable } from 'type-fest';
import crossIcon from '../../../assets/icons/cross.svg';
import { useCharacterDataMultiple } from '../../../character/character.ts';
import type { ChildrenProps } from '../../../common/reactTypes.ts';
import { useAsyncEvent, useEvent } from '../../../common/useEvent.ts';
import { TextInput } from '../../../common/userInteraction/input/textInput.tsx';
import { Button, IconButton } from '../../../components/common/button/button.tsx';
import { Column, Row } from '../../../components/common/container/container.tsx';
import { ModalDialog } from '../../../components/dialog/dialog.tsx';
import { useResolveAccountName, useSpaceCharacters } from '../../../components/gameContext/gameStateContextProvider.tsx';
import { TOAST_OPTIONS_ERROR } from '../../../persistentToast.ts';
import { useCurrentAccount } from '../../../services/accountLogic/accountManagerHooks.ts';
import './accountListInput.scss';

export interface AccountListInputProps {
	value: readonly AccountId[];
	max?: number;
	onChange?: (newValue: readonly AccountId[]) => Promisable<void>;
	/**
	 * Indicates that all entries should be shown.
	 * @default false
	 */
	noLimitHeight?: boolean;
	/**
	 * Whether selecting own account should be allowed
	 * @default false
	 */
	allowSelf?: boolean;
}

export function AccountListInput({ value, onChange, ...props }: AccountListInputProps): ReactElement {

	const onAdd = useEvent((a: AccountId) => {
		if (value.includes(a))
			return;

		return onChange?.([...value, a].sort(CompareAccountIds));
	});

	const onRemove = useEvent((a: AccountId) => {
		if (!value.includes(a))
			return;

		return onChange?.(value.filter((i) => i !== a));
	});

	return (
		<AccountListInputActions
			{ ...props }
			value={ value }
			onAdd={ onChange != null ? onAdd : undefined }
			onRemove={ onChange != null ? onRemove : undefined }
		/>
	);
}

export type AccountListInputActionsProps = Omit<AccountListInputProps, 'onChange'> & {
	onAdd?: (accountToAdd: AccountId) => Promisable<void>;
	onRemove?: (accountToRemove: AccountId) => Promisable<void>;
};

type AccountListInputActionsContext = {
	executeAdd: (accountToAdd: AccountId, callback?: (() => void) | undefined) => void;
	executeRemove: (accountToRemove: AccountId) => void;
	processing: boolean;
};

export function AccountListInputActions({
	onAdd,
	onRemove,
	...props
}: AccountListInputActionsProps): ReactElement {
	const [executeAdd, processingAdd] = useAsyncEvent(async (accountToAdd: AccountId, callback?: () => void) => {
		if (onAdd == null)
			throw new Error('Adding not supported');

		await onAdd(accountToAdd);
		return callback;
	}, (callback) => {
		// Run any passed callback on success
		callback?.();
	}, {
		errorHandler: (err) => {
			GetLogger('AccountListInput').error('Failed to add account:', err);
			toast('Error performing action, try again later', TOAST_OPTIONS_ERROR);
		},
	});

	const [executeRemove, processingRemove] = useAsyncEvent(async (accountToRemove: AccountId) => {
		if (onRemove == null)
			throw new Error('Removing not supported');

		await onRemove(accountToRemove);
	}, null, {
		errorHandler: (err) => {
			GetLogger('AccountListInput').error('Failed to remove account:', err);
			toast('Error performing action, try again later', TOAST_OPTIONS_ERROR);
		},
	});

	const processing = processingAdd || processingRemove;

	const actionButtonContext = useMemo((): AccountListInputActionsContext => ({
		executeAdd,
		executeRemove,
		processing,
	}), [executeAdd, executeRemove, processing]);

	return (
		<AccountListInputActionButtons<AccountListInputActionsContext>
			{ ...props }
			actionContext={ actionButtonContext }
			AddButton={ onAdd != null ? AccountListInputActionsAddButton : undefined }
			RemoveButton={ onRemove != null ? AccountListInputActionsRemoveButton : undefined }
		/>
	);
}

function AccountListInputActionsAddButton({ addId, onExecute, children, actionContext, slim, disabled }: AccountListInputAddButtonProps<AccountListInputActionsContext>) {
	return (
		<Button
			onClick={ () => {
				if (addId != null) {
					actionContext.executeAdd(addId, onExecute);
				}
			} }
			disabled={ disabled || actionContext.processing }
			slim={ slim }
		>
			{ children }
		</Button>
	);
}

function AccountListInputActionsRemoveButton({ removeId, actionContext }: AccountListInputRemoveButtonProps<AccountListInputActionsContext>) {
	return (
		<IconButton
			src={ crossIcon }
			alt='Remove entry'
			onClick={ () => {
				actionContext.executeRemove(removeId);
			} }
			slim
			disabled={ actionContext.processing }
		/>
	);
}

export interface AccountListInputAddButtonProps<TActionContext> extends ChildrenProps {
	addId: AccountId | null;
	slim: boolean;
	onExecute?: () => void;
	disabled: boolean;
	actionContext: TActionContext;
}

export interface AccountListInputRemoveButtonProps<TActionContext> {
	removeId: AccountId;
	actionContext: TActionContext;
}

export type AccountListInputActionButtonsProps<TActionContext> = Omit<AccountListInputProps, 'onChange'> & {
	// eslint-disable-next-line @typescript-eslint/naming-convention
	AddButton?: React.FC<AccountListInputAddButtonProps<TActionContext>>;
	// eslint-disable-next-line @typescript-eslint/naming-convention
	RemoveButton?: React.FC<AccountListInputRemoveButtonProps<TActionContext>>;
	actionContext: TActionContext;
};

export function AccountListInputActionButtons<TActionContext>({
	value,
	max,
	AddButton,
	RemoveButton,
	actionContext,
	noLimitHeight = false,
	allowSelf = false,
}: AccountListInputActionButtonsProps<TActionContext>): ReactElement {
	const valueOrdered = useMemo(() => value.slice().sort(CompareAccountIds), [value]);

	const [showDialog, setShowDialog] = useState(false);

	return (
		<Column gap='medium'>
			<Column padding='small' gap='small' overflowY='auto' className={ classNames('accountListInput', noLimitHeight ? null : 'limitHeight') }>
				{
					value.length > 0 ? (
						valueOrdered.map((a) => (
							<AccountListItem
								key={ a }
								id={ a }
								actionContext={ actionContext }
								RemoveButton={ RemoveButton }
							/>
						))
					) : (
						<span>[ Empty ]</span>
					)
				}
			</Column>
			{
				AddButton != null ? (
					<Row alignX='space-between' alignY='center'>
						<Button
							onClick={ () => {
								setShowDialog(true);
							} }
							disabled={ max != null && value.length >= max }
							slim
						>
							Add an account
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
				(AddButton != null && showDialog) ? (
					<AccountListQuickSelectDialog
						value={ value }
						close={ () => {
							setShowDialog(false);
						} }
						allowSelf={ allowSelf }
						AddButton={ AddButton }
						actionContext={ actionContext }
					/>
				) : null
			}
		</Column>
	);
}

function AccountListItem<TActionContext>({ id, RemoveButton, actionContext }: {
	id: AccountId;
	// eslint-disable-next-line @typescript-eslint/naming-convention
	RemoveButton?: React.FC<AccountListInputRemoveButtonProps<TActionContext>>;
	actionContext: TActionContext;
}): ReactElement {
	const playerAccount = useCurrentAccount();

	return (
		<Row alignY='center' padding='small' className='listItem'>
			<span className='flex-1'>
				{ useResolveAccountName(id) ?? '[unknown]' } ({ id }) { (id === playerAccount?.id) ? '[You]' : '' }
			</span>
			{
				RemoveButton != null ? (
					<RemoveButton
						actionContext={ actionContext }
						removeId={ id }
					/>
				) : null
			}
		</Row>
	);
}

type QuickListAccountInfo = {
	id: AccountId;
	name: string;
	characters: ICharacterRoomData[];
};

function AccountListQuickSelectDialog<TActionContext>({ value, allowSelf, close, AddButton, actionContext }: {
	value: readonly AccountId[];
	close: () => void;
	allowSelf: boolean;
	// eslint-disable-next-line @typescript-eslint/naming-convention
	AddButton: React.FC<AccountListInputAddButtonProps<TActionContext>>;
	actionContext: TActionContext;
}): ReactElement {
	const currentAccount = useCurrentAccount();
	Assert(currentAccount != null);
	const [dialogAccountId, setDialogAccountId] = useState<AccountId | null>(null);

	const spaceCharacters = useSpaceCharacters();
	const spaceCharactersData = useCharacterDataMultiple(spaceCharacters);

	const quickList = useMemo((): QuickListAccountInfo[] => {
		const result: QuickListAccountInfo[] = [
			{
				id: currentAccount.id,
				name: currentAccount.displayName,
				characters: [],
			},
		];

		for (const character of spaceCharactersData) {
			let account = result.find((a) => a.id === character.accountId);
			if (account == null) {
				account = {
					id: character.accountId,
					name: character.accountDisplayName,
					characters: [],
				};
				result.push(account);
			}
			account.characters.push(character);
		}

		for (const account of result) {
			account.characters.sort((a, b) => a.name.localeCompare(b.name));
		}

		return result.sort((a, b) => {
			if ((a.id === currentAccount.id) !== (b.id === currentAccount.id)) {
				return (a.id === currentAccount.id) ? -1 : 1;
			}

			return a.name.localeCompare(b.name);
		});
	}, [currentAccount, spaceCharactersData]);

	const resolvedName = useResolveAccountName(dialogAccountId ?? 0) ?? '[unknown]';

	return (
		<ModalDialog>
			<Column>
				<h2>Select account</h2>
				<Row alignY='center'>
					<label>Name:</label>
					<span>{ dialogAccountId == null ? '...' : resolvedName }</span>
				</Row>
				<Row alignY='center'>
					<label>Id:</label>
					<TextInput
						className='flex-1'
						value={ dialogAccountId?.toString(10) ?? '' }
						onChange={ (newValue) => {
							const parsedInputValue = AccountIdSchema.safeParse(Number.parseInt(newValue));
							if (parsedInputValue.success) {
								setDialogAccountId(parsedInputValue.data);
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
					<AddButton
						addId={ dialogAccountId }
						actionContext={ actionContext }
						onExecute={ close }
						slim={ false }
						disabled={ dialogAccountId == null || value.includes(dialogAccountId) }
					>
						Confirm
					</AddButton>
				</Row>
				<hr className='fill-x' />
				<fieldset>
					<legend>Quick selection</legend>
					<Column alignX='start'>
						{
							quickList
								.filter((a) => allowSelf || a.id !== currentAccount.id)
								.map((a) => (
									<AddButton
										key={ a.id }
										addId={ a.id }
										actionContext={ actionContext }
										onExecute={ close }
										slim
										disabled={ value.includes(a.id) }
									>
										<Column alignX='start' gap='tiny'>
											<span>{ a.name } ({ a.id })  { (a.id === currentAccount.id) ? '[You]' : '' }  { value.includes(a.id) ? '[Already in the list]' : '' }</span>
											{ a.characters.length > 0 ? <>({ a.characters.map((c) => c.name).join(', ') })</> : null }
										</Column>
									</AddButton>
								))
						}
					</Column>
				</fieldset>
			</Column>
		</ModalDialog>
	);
}
