import { AssertNever } from 'pandora-common';
import { BotDescriptionSchema, BotNameSchema, type BotConfig, type BotDefinition, type BotId, type PandoraBotSpacePermissionList } from 'pandora-common/bots';
import { useId, useMemo, useState, type ReactElement } from 'react';
import { toast } from 'react-toastify';
import { CopyToClipboardButton } from '../../../../common/clipboard.tsx';
import { useAsyncEvent } from '../../../../common/useEvent.ts';
import { Checkbox } from '../../../../common/userInteraction/checkbox.tsx';
import { TextAreaInput } from '../../../../common/userInteraction/input/textAreaInput.tsx';
import { TextInput } from '../../../../common/userInteraction/input/textInput.tsx';
import { Button } from '../../../../components/common/button/button.tsx';
import { Column, Row } from '../../../../components/common/container/container.tsx';
import { FormCreateStringValidator } from '../../../../components/common/form/form.tsx';
import { ModalDialog } from '../../../../components/dialog/dialog.tsx';
import { useDirectoryConnector } from '../../../../components/gameContext/directoryConnectorContextProvider.tsx';
import { TOAST_OPTIONS_ERROR } from '../../../../persistentToast.ts';
import { SudoModeButton, useSudoMode } from '../securitySettings/sudoMode.tsx';
import { BotSpacePermissions } from './botPermissionSelection.tsx';

export function BotCreateDialog({ close, onCreated }: {
	close: () => void;
	onCreated: (id: BotId, config: BotConfig) => void;
}): ReactElement {
	const id = useId();
	const { sudoActive, clearSudoMode } = useSudoMode();
	const directoryConnector = useDirectoryConnector();

	const [name, setName] = useState('');
	const [description, setDescription] = useState('');
	const [requestedPermissions, setRequestedPermissions] = useState<PandoraBotSpacePermissionList>([]);
	const [isPrivate, setIsPrivate] = useState(true);

	const nameError = useMemo(() => (
		FormCreateStringValidator(BotNameSchema, 'name')(name)
	), [name]);
	const descriptionError = useMemo(() => (
		FormCreateStringValidator(BotDescriptionSchema, 'description')(description)
	), [description]);

	const [createBot, processing] = useAsyncEvent(
		() => {
			const config: BotConfig = {
				name,
				description,
				private: isPrivate,
				requestedPermissions,
			};
			const result = directoryConnector.awaitResponse('botDevelopmentCreate', {
				config,
			});
			return result.then((r) => ([r, config] as const));
		},
		([result, config]) => {
			if (result.result === 'ok') {
				onCreated(result.id, config);
			} else if (result.result === 'sudoRequired') {
				toast('Please re-authenticate before creating the bot', TOAST_OPTIONS_ERROR);
				clearSudoMode();
			} else if (result.result === 'notAllowed') {
				toast(
					`You are not authorized to create bots.`,
					TOAST_OPTIONS_ERROR,
				);
			} else if (result.result === 'failed') {
				toast(
					`Bot creation failed. Try again later.`,
					TOAST_OPTIONS_ERROR,
				);
			} else {
				AssertNever(result);
			}
		},
	);

	return (
		<ModalDialog>
			<Column gap='large'>
				<h3>
					Create new bot
				</h3>
				<Column gap='small'>
					<label htmlFor={ id + ':name' }>Name (users will see this in a list)</label>
					<TextInput
						id={ id + ':name' }
						value={ name }
						onChange={ (newName) => {
							setName(newName.trim());
						} }
					/>
					{ nameError ? (
						<span className='error'>{ nameError }</span>
					) : null }
				</Column>
				<Column gap='small'>
					<label htmlFor={ id + ':description' }>Description (visible in bot's details)</label>
					<TextAreaInput
						id={ id + ':description' }
						value={ description }
						onChange={ (newDescription) => {
							setDescription(newDescription.trim());
						} }
					/>
					{ nameError ? (
						<span className='error'>{ descriptionError }</span>
					) : null }
				</Column>
				<Column gap='small'>
					<label>
						<Checkbox
							onChange={ (newValue) => {
								setIsPrivate(newValue);
							} }
							checked={ isPrivate }
						/>
						Bot is private (is only visible to you and only you can assign it to spaces)
					</label>
				</Column>
				<BotSpacePermissions
					selectedPermissions={ requestedPermissions }
					onChange={ setRequestedPermissions }
				/>
				<Row alignX='space-between' wrap>
					<Button
						onClick={ close }
					>
						Cancel
					</Button>
					{ sudoActive ? (
						<Button
							onClick={ createBot }
							disabled={ processing || nameError != null }
						>
							Create bot
						</Button>
					) : (
						<SudoModeButton>
							Create bot
						</SudoModeButton>
					) }
				</Row>
			</Column>
		</ModalDialog>
	);
}

export function BotEditDialog({ close, onChange, botDefinition }: {
	close: () => void;
	onChange: () => void;
	botDefinition: BotDefinition;
}): ReactElement {
	const id = useId();
	const { sudoActive, clearSudoMode } = useSudoMode();
	const directoryConnector = useDirectoryConnector();

	const [name, setName] = useState<string | null>(null);
	const [description, setDescription] = useState<string | null>(null);
	const [requestedPermissions, setRequestedPermissions] = useState<PandoraBotSpacePermissionList | null>(null);
	const [isPrivate, setIsPrivate] = useState<boolean | null>(null);

	const nameError = useMemo(() => (
		FormCreateStringValidator(BotNameSchema, 'name')(name ?? botDefinition.name)
	), [name, botDefinition.name]);
	const descriptionError = useMemo(() => (
		FormCreateStringValidator(BotDescriptionSchema, 'description')(description ?? botDefinition.description)
	), [description, botDefinition.description]);

	const [updateBot, processing] = useAsyncEvent(
		() => directoryConnector.awaitResponse('botDevelopmentUpdate', {
			id: botDefinition.id,
			config: {
				name: name ?? botDefinition.name,
				description: description ?? botDefinition.description,
				requestedPermissions: requestedPermissions ?? botDefinition.requestedPermissions,
				private: isPrivate ?? botDefinition.private,
			},
		}),
		({ result }) => {
			onChange();
			if (result === 'ok') {
				close();
			} else if (result === 'sudoRequired') {
				toast('Please re-authenticate before performing these changes', TOAST_OPTIONS_ERROR);
				clearSudoMode();
			} else if (result === 'notFound') {
				toast(`Bot not found`, TOAST_OPTIONS_ERROR);
				close();
			} else if (result === 'failed') {
				toast(`Failed to update the bot. Try again later.`, TOAST_OPTIONS_ERROR);
				close();
			} else {
				AssertNever(result);
			}
		},
	);

	return (
		<ModalDialog>
			<Column gap='large'>
				<h3>
					Bot "{ botDefinition.name || botDefinition.id }"
				</h3>
				<Column gap='small'>
					<label htmlFor={ id + ':id' }>Unique ID</label>
					<Row>
						<TextInput
							id={ id + ':id' }
							value={ botDefinition.id }
							readOnly
							className='flex-grow-1'
						/>
						<CopyToClipboardButton
							text={ botDefinition.id }
							buttonText='Copy to clipboard'
							slim
						/>
					</Row>
				</Column>
				<Column gap='small'>
					<label htmlFor={ id + ':name' }>Name (users will see this in a list)</label>
					<TextInput
						id={ id + ':name' }
						value={ name ?? botDefinition.name }
						onChange={ (newName) => {
							setName(newName.trim());
						} }
					/>
					{ nameError ? (
						<span className='error'>{ nameError }</span>
					) : null }
				</Column>
				<Column gap='small'>
					<label htmlFor={ id + ':description' }>Description (visible in bot's details)</label>
					<TextAreaInput
						id={ id + ':description' }
						value={ description ?? botDefinition.description }
						onChange={ (newDescription) => {
							setDescription(newDescription.trim());
						} }
					/>
					{ nameError ? (
						<span className='error'>{ descriptionError }</span>
					) : null }
				</Column>
				<Column gap='small'>
					<label>
						<Checkbox
							onChange={ (newValue) => {
								setIsPrivate(newValue);
							} }
							checked={ isPrivate ?? botDefinition.private }
						/>
						Bot is private (is only visible to you and only you can assign it to spaces)
					</label>
				</Column>
				<BotSpacePermissions
					selectedPermissions={ requestedPermissions ?? botDefinition.requestedPermissions }
					onChange={ setRequestedPermissions }
				/>

				<Row alignX='space-between' wrap>
					<Button
						onClick={ close }
					>
						Cancel
					</Button>
					{ sudoActive ? (
						<Button
							onClick={ updateBot }
							disabled={ processing || (name == null && description == null && isPrivate == null && requestedPermissions == null) }
						>
							Update bot
						</Button>
					) : (
						<SudoModeButton>
							Update bot
						</SudoModeButton>
					) }
				</Row>
			</Column>
		</ModalDialog>
	);
}

export function BotCreatedDialog({ close, id }: {
	close: () => void;
	id: BotId;
	config: BotConfig;
}): ReactElement {
	return (
		<ModalDialog>
			<Column>
				<h3>Bot created</h3>
				<div>The bot has been assigned this ID</div>
				<Column padding='medium'>
					<CopyToClipboardButton
						text={ id }
						buttonText='Copy to clipboard'
						className='align-self-end'
					/>
					<pre>
						<code className='selectable-all'>
							{ id }
						</code>
					</pre>
				</Column>
				<Row alignX='center'>
					<Button
						onClick={ close }
					>
						Close
					</Button>
				</Row>
			</Column>
		</ModalDialog>
	);
}
