import { AccountIdSchema, Assert, GetLogger, type AccountId, type ICharacterRoomData, type Promisable } from 'pandora-common';
import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { useCharacterDataMultiple } from '../../../character/character.ts';
import type { ChildrenProps } from '../../../common/reactTypes.ts';
import { useAsyncEvent } from '../../../common/useEvent.ts';
import { TextInput } from '../../../common/userInteraction/input/textInput.tsx';
import { Button } from '../../../components/common/button/button.tsx';
import { Column, Row } from '../../../components/common/container/container.tsx';
import { ModalDialog } from '../../../components/dialog/dialog.tsx';
import { TOAST_OPTIONS_ERROR } from '../../../persistentToast.ts';
import { useCurrentAccount } from '../../../services/accountLogic/accountManagerHooks.ts';
import { useResolveAccountName } from '../../../services/accountLogic/accountNameResolution.ts';
import { useSpaceCharacters } from '../../../services/gameLogic/gameStateHooks.ts';
import './accountListInput.scss';

type QuickListAccountInfo = {
	id: AccountId;
	name: string;
	characters: ICharacterRoomData[];
};

export interface AccountListInputAddButtonProps<TActionContext> extends ChildrenProps {
	accountId: AccountId | null;
	slim: boolean;
	onExecute?: () => void;
	disabled: boolean;
	actionContext: TActionContext;
}

export interface AccountInputQuickSelectDialogProps {
	onSelect: (account: AccountId) => Promisable<void>;
	close: () => void;
	/**
	 * Whether selecting own account should be allowed
	 * @default false
	 */
	allowSelf?: boolean;
}

export function AccountInputQuickSelectDialog({ onSelect, close, allowSelf = false }: AccountInputQuickSelectDialogProps): ReactElement {
	const [execute, processing] = useAsyncEvent(async (account: AccountId, callback?: () => void) => {
		await onSelect(account);
		return callback;
	}, (callback) => {
		// Run any passed callback on success
		callback?.();
	}, {
		errorHandler: (err) => {
			GetLogger('AccountInputQuickSelectDialog').error('Error processing action:', err);
			toast('Error performing action, try again later', TOAST_OPTIONS_ERROR);
		},
	});

	const actionButtonContext = useMemo((): AccountListInputGenericContext => ({
		execute,
		processing,
	}), [execute, processing]);

	return (
		<AccountListInputQuickSelectDialog<AccountListInputGenericContext>
			allowSelf={ allowSelf }
			close={ close }
			AddButton={ AccountInputQuickSelectDialogGenericButton }
			actionContext={ actionButtonContext }
		/>
	);
}

type AccountListInputGenericContext = {
	execute: (account: AccountId, callback?: (() => void) | undefined) => void;
	processing: boolean;
};

function AccountInputQuickSelectDialogGenericButton({ accountId, onExecute, children, actionContext, slim, disabled }: AccountListInputAddButtonProps<AccountListInputGenericContext>) {
	return (
		<Button
			onClick={ () => {
				if (accountId != null) {
					actionContext.execute(accountId, onExecute);
				}
			} }
			disabled={ disabled || actionContext.processing }
			slim={ slim }
		>
			{ children }
		</Button>
	);
}

export function AccountListInputQuickSelectDialog<TActionContext>({ alreadyPresent, allowSelf, close, AddButton, actionContext }: {
	alreadyPresent?: readonly AccountId[];
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
						accountId={ dialogAccountId }
						actionContext={ actionContext }
						onExecute={ close }
						slim={ false }
						disabled={ dialogAccountId == null || (alreadyPresent?.includes(dialogAccountId) ?? false) }
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
										accountId={ a.id }
										actionContext={ actionContext }
										onExecute={ close }
										slim
										disabled={ (alreadyPresent?.includes(a.id) ?? false) }
									>
										<Column alignX='start' gap='tiny'>
											<span>{ a.name } ({ a.id })  { (a.id === currentAccount.id) ? '[You]' : '' }  { alreadyPresent?.includes(a.id) ? '[Already in the list]' : '' }</span>
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
