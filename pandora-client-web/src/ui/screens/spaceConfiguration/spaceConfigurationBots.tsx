import type { Immutable } from 'immer';
import { AssertNever, AssertNotNullable, GetLogger, Option, type SpaceBotAssignmentConfig } from 'pandora-common';
import type { BotDefinition, BotId } from 'pandora-common/bots';
import { ReactElement, useCallback, useEffect, useMemo, useRef, useState, type ForwardedRef } from 'react';
import { TextInput } from '../../../common/userInteraction/input/textInput.tsx';
import { useInputAutofocus } from '../../../common/userInteraction/inputAutofocus.ts';
import { Button } from '../../../components/common/button/button.tsx';
import { Column, Row } from '../../../components/common/container/container.tsx';
import { ExternalLink } from '../../../components/common/link/externalLink.tsx';
import { SelectionIndicator } from '../../../components/common/selectionIndicator/selectionIndicator.tsx';
import { ModalDialog } from '../../../components/dialog/dialog.tsx';
import { useDirectoryConnector } from '../../../components/gameContext/directoryConnectorContextProvider.tsx';
import { ContextHelpButton } from '../../../components/help/contextHelpButton.tsx';
import { useCurrentAccount } from '../../../services/accountLogic/accountManagerHooks.ts';
import { useResolveAccountName } from '../../../services/accountLogic/accountNameResolution.ts';
import { RichTextDescription } from '../../components/richText/richText.tsx';
import { BotSpacePermissions } from '../settings/botDevelopmentSettings/botPermissionSelection.tsx';
import type { SpaceConfigurationTabProps } from './spaceConfiguration.tsx';
import './spaceConfigurationBots.scss';

export function SpaceConfigurationBots({
	canEdit,
	currentConfig,
	updateConfig,
}: Pick<SpaceConfigurationTabProps, 'canEdit' | 'currentConfig' | 'updateConfig'>): ReactElement {
	const [botSelectionOpen, setBotSelectionOpen] = useState(false);

	return (
		<fieldset>
			<legend>
				Bots
				<ContextHelpButton>
					<p>
						This setting allows you to select a community-run bot to interact with this space.<br />
						Each space can have at most one bot active at a time.<br />
						<strong>Bots are an experimental feature and will change in the future!</strong>
					</p>
					<p>
						<strong>Bots are not official — they are hosted by community members like you!</strong><br />
						Selecting a bot will allow it to do anything with the access you give it.
						What it does might even change over time without your knowledge.
						Be sure you trust the author of the bot and that you want to give it access to this space.
					</p>
					<p>
						If you are interested in creating your own bot,
						you can get in touch with us using the <code>#development-help</code> channel in <ExternalLink className='inline' href='https://discord.gg/EnaPvuQf8d' sendReferrer>Pandora's Discord</ExternalLink>.
					</p>
				</ContextHelpButton>
			</legend>
			<Column>
				<Button
					onClick={ () => {
						setBotSelectionOpen(true);
					} }
					disabled={ !canEdit }
				>
					Change Space's bot
				</Button>
				{ currentConfig.bot != null ? (
					<SpaceConfigurationBotConfig
						canEdit={ canEdit }
						currentConfig={ currentConfig.bot }
						updateConfig={ (update) => {
							AssertNotNullable(currentConfig.bot);
							updateConfig({
								bot: {
									...currentConfig.bot,
									...update,
								},
							});
						} }
					/>
				) : (
					<i>No bot selected for this space</i>
				) }
			</Column>
			{ botSelectionOpen ? (
				<SpaceConfigurationBotSelectionDialog
					current={ currentConfig.bot?.bot ?? null }
					selectBot={ canEdit ? (bot) => {
						setBotSelectionOpen(false);
						if (bot == null) {
							updateConfig({
								bot: null,
							});
						} else {
							updateConfig({
								bot: {
									bot,
									permissions: [],
								},
							});
						}
					} : null }
					close={ () => {
						setBotSelectionOpen(false);
					} }
				/>
			) : null }
		</fieldset>
	);
}

function SpaceConfigurationBotConfig({ canEdit, currentConfig, updateConfig }: {
	canEdit: boolean;
	currentConfig: Immutable<SpaceBotAssignmentConfig>;
	updateConfig: (update: Partial<SpaceBotAssignmentConfig>) => void;
}): ReactElement {
	const directoryConnector = useDirectoryConnector();

	const [receivedDetails, setDetails] = useState<Option<BotDefinition | 'notFound' | 'error'>>(Option.None);
	const details = receivedDetails.filter((it) => typeof it === 'string' || it?.id === currentConfig.bot);

	const loadDetails = useCallback(() => {
		(async () => {
			const result = await directoryConnector.awaitResponse('botGetBotDetails', { id: currentConfig.bot });

			if (result.result === 'ok') {
				setDetails(Option.Some(result.details));
			} else if (result.result === 'notFound') {
				setDetails(Option.Some(result.result));
			} else {
				AssertNever(result);
			}
		})()
			.catch((err) => {
				GetLogger('SpaceConfigurationBotConfig').error('Error getting bot details:', err);
				setDetails(Option.Some('error' as const));
			});
	}, [currentConfig.bot, directoryConnector]);

	useEffect(() => {
		loadDetails();
	}, [loadDetails]);

	if (details.is_none()) {
		return (
			<>
				<div>Selected bot: <code className='selectable-all'>{ currentConfig.bot }</code></div>
				<i>Loading details…</i>
			</>
		);
	}

	if (details.value === 'error') {
		return (
			<>
				<div>Selected bot: <code className='selectable-all'>{ currentConfig.bot }</code></div>
				<Row className='error-box' alignY='center'>
					<span className='flex-1'>Error loading details!</span>
					<Button onClick={ loadDetails }>
						Retry
					</Button>
				</Row>
			</>
		);
	}

	if (details.value === 'notFound') {
		return (
			<>
				<div>Selected bot: <code className='selectable-all'>{ currentConfig.bot }</code></div>
				<Column className='warning-box'>
					<strong>Selected bot not found</strong>
					<span>
						This is most likely because the bot has been removed by its author.<br />
						The bot will not be able to affect the space, but any persistent restrictions will be kept until the settings are changed.
					</span>
				</Column>
			</>
		);
	}

	const { name, requestedPermissions } = details.value;

	return (
		<>
			<div>Selected bot: { name } (<code className='selectable-all'>{ currentConfig.bot }</code>)</div>
			<Column gap='tiny'>
				{ canEdit ? (
					<>
						{ currentConfig.permissions.some((p) => !requestedPermissions.includes(p)) ? (
							<div className='warning-box'>
								There are some selected permissions that this bot no longer requires.
								These permissions have no effect and will be removed when you make any change to the permissions below.
							</div>
						) : null }
						<BotSpacePermissions
							selectedPermissions={ currentConfig.permissions }
							onChange={ (newPermissions) => {
								updateConfig({
									permissions: newPermissions,
								});
							} }
							filterPermissions={ requestedPermissions }
						/>
						{ requestedPermissions.some((p) => !currentConfig.permissions.includes(p)) ? (
							<div className='warning-box'>
								You have not selected all permissions that the bot requests.<br />
								While you can use the bot like this, its capabilities might be limited or it might break altogether —
								depending on how it was created.
							</div>
						) : null }
					</>
				) : (
					<BotSpacePermissions
						selectedPermissions={ currentConfig.permissions }
						onChange={ null }
						filterPermissions={ currentConfig.permissions }
					/>
				) }
			</Column>
		</>
	);
}

function SpaceConfigurationBotSelectionDialog({ current, selectBot, close }: {
	current: BotId | null;
	selectBot: ((bot: BotId | null) => void) | null;
	close: () => void;
}): ReactElement {
	const directoryConnector = useDirectoryConnector();

	const [selectedBot, setSelectedBot] = useState<BotId | null>(current);
	const [receivedDetails, setDetails] = useState<Option<BotDefinition | 'error' | 'notFound'>>(Option.None);
	const details = receivedDetails.filter((it) => typeof it === 'string' || it?.id === selectedBot);
	const ownerName = useResolveAccountName(details.map((it) => typeof it !== 'string' ? it.ownerAccount : null).unwrap_or(null)) ?? '[unknown]';

	const loadDetails = useCallback(() => {
		if (selectedBot == null) {
			setDetails(Option.None);
			return;
		}

		const bot = selectedBot;

		(async () => {
			const result = await directoryConnector.awaitResponse('botGetBotDetails', { id: bot });

			if (result.result === 'ok') {
				setDetails(Option.Some(result.details));
			} else if (result.result === 'notFound') {
				setDetails(Option.Some(result.result));
			} else {
				AssertNever(result);
			}
		})()
			.catch((err) => {
				GetLogger('SpaceConfigurationBotConfig').error('Error getting bot details:', err);
				setDetails(Option.Some('error' as const));
			});
	}, [selectedBot, directoryConnector]);

	useEffect(() => {
		loadDetails();
	}, [loadDetails]);

	return (
		<ModalDialog position='max-size' priority={ 3 }>
			<Column gap='large' className='SpaceConfigurationBotSelectionDialog flex-1'>
				<BotSelectUi
					value={ selectedBot }
					onChange={ setSelectedBot }
					activeValue={ current }
				/>
				<Column className='botDetails' gap='large'>
					{ selectedBot == null ? (
						<i>No bot selected</i>
					) : details.is_none() ? (
						<span>Loading…</span>
					) : typeof details.value === 'string' ? (
						<span className='warning-box'>
							Error getting bot details: { details.value }
						</span>
					) : (
						<>
							<span>Bot: { details.value.name } (<code className='selectable-all'>{ details.value.id }</code>)</span>
							<span>Created by: { ownerName } ({ details.value.ownerAccount })</span>
							<Column gap='tiny'>
								<span>Description:</span>
								<RichTextDescription content={ details.value.description } />
							</Column>
							<BotSpacePermissions
								selectedPermissions={ [] }
								filterPermissions={ details.value.requestedPermissions }
								onChange={ null }
							/>
						</>
					) }
				</Column>
				<Row className='fill-x' alignX='space-between' wrap>
					<Button onClick={ close }>Cancel</Button>
					<Button
						onClick={ () => {
							selectBot?.(selectedBot);
						} }
						disabled={ selectBot == null || selectedBot === current }
					>
						Select bot
					</Button>
				</Row>
			</Column>
		</ModalDialog>
	);
}

export function BotSelectUi({ value, onChange, activeValue }: {
	value: BotId | null;
	onChange: (newValue: BotId | null) => void;
	/** Value that is being used until the change is confirmed */
	activeValue?: BotId | null;
}): ReactElement {
	const playerAccountId = useCurrentAccount()?.id;
	const directoryConnector = useDirectoryConnector();

	const [nameFilter, setNameFilter] = useState('');
	const [loadedBots, setLoadedBots] = useState<Immutable<BotDefinition[]> | null>(null);

	const activeBotRef = useRef<HTMLDivElement>(null);

	const loadBotList = useCallback(() => {
		(async () => {
			const result = await directoryConnector.awaitResponse('botListPublic', {});
			setLoadedBots(result.bots);

			setTimeout(() => {
				activeBotRef.current?.scrollIntoView({ block: 'center' });
			}, 50);
		})().catch((err) => {
			GetLogger('BotSelectUi').error('Error loading bot list:', err);
		});
	}, [directoryConnector]);

	useEffect(() => {
		loadBotList();
	}, [loadBotList]);

	/** Comparator for sorting backgrounds */
	const botSortOrder = useCallback((a: Immutable<BotDefinition>, b: Immutable<BotDefinition>): number => {
		const ownBotA = a.ownerAccount === playerAccountId;
		const ownBotB = b.ownerAccount === playerAccountId;

		if (ownBotA !== ownBotB)
			return ownBotA ? -1 : 1;

		if (a.ownerAccount !== b.ownerAccount)
			return b.ownerAccount - a.ownerAccount; // TODO: Use names instead?

		return a.name.localeCompare(b.name);
	}, [playerAccountId]);

	const botsToShow = useMemo(() => {
		const filterParts = nameFilter.toLowerCase().trim().split(/\s+/);
		return (loadedBots ?? [])
			.filter((b) => b.id === activeValue ||
				b.id === value ||
				filterParts.every((f) => b.name.toLowerCase().includes(f) ||
					b.description.toLowerCase().includes(f) ||
					b.ownerAccount.toString(10).includes(f),
				),
			)
			.sort(botSortOrder);
	}, [nameFilter, loadedBots, botSortOrder, activeValue, value]);

	const nameFilterInput = useRef<TextInput>(null);
	useInputAutofocus(nameFilterInput);

	return (
		<div className='BotSelectUi'>
			<span>Select a community bot</span>
			<Row wrap>
				<TextInput ref={ nameFilterInput }
					className='input-filter flex-grow-2'
					placeholder='Filter by name or description…'
					value={ nameFilter }
					onChange={ setNameFilter }
				/>
				<span className='flex-grow-1' />
				<Button
					slim
					onClick={ () => {
						setLoadedBots(null);
						setTimeout(loadBotList, 200);
					} }
				>
					Reload
				</Button>
			</Row>
			<Column className='bot-list' gap='tiny' padding='small'>
				<BotSelectUiElement
					ref={ activeValue == null ? activeBotRef : undefined }
					bot={ null }
					selected={ value == null }
					active={ activeValue == null }
					onClick={ () => {
						onChange(null);
					} }
				/>
				{ activeValue != null && !botsToShow.some((b) => b.id === activeValue) ? (
					// Show current selection, even if it wasn't found
					<BotSelectUiElement
						ref={ activeBotRef }
						bot={ activeValue }
						selected={ value === activeValue }
						active={ true }
						onClick={ () => {
							onChange(activeValue);
						} }
					/>
				) : null }
				{ value != null && value !== activeValue && !botsToShow.some((b) => b.id === value) ? (
					// Show current selection, even if it wasn't found
					<BotSelectUiElement
						bot={ value }
						selected={ true }
						active={ activeValue === value }
						onClick={ () => {
							onChange(value);
						} }
					/>
				) : null }
				{ botsToShow
					.map((b) => (
						<BotSelectUiElement key={ b.id }
							ref={ activeValue == null ? activeBotRef : undefined }
							bot={ b }
							selected={ value === b.id }
							active={ activeValue === b.id }
							onClick={ () => {
								onChange(b.id);
							} }
						/>
					)) }
				{ loadedBots == null ? (
					<span>Loading…</span>
				) : null }
			</Column>
		</div>
	);
}

function BotSelectUiElement({ bot, selected, active, onClick, ref }: {
	bot: BotDefinition | BotId | null;
	selected: boolean;
	active: boolean;
	onClick: () => void;
	ref?: ForwardedRef<HTMLDivElement>;
}): ReactElement {
	const ownerName = useResolveAccountName(bot != null && typeof bot !== 'string' ? bot.ownerAccount : null) ?? '[unknown]';

	return (
		<SelectionIndicator
			ref={ ref }
			padding='tiny'
			selected={ selected }
			active={ active }
		>
			<Button
				className='fill'
				onClick={ onClick }
			>
				<Column className='details fill'>
					<Row alignY='end' gap='tiny'>
						{ bot == null ? (
							<span>[ None ]</span>
						) : typeof bot === 'string' ? (
							<span>[ Error: Unknown bot <code>{ bot }</code> ]</span>
						) : (
							<>
								<strong>{ bot.name }</strong>
								<span className='credits'>by { ownerName } ({ bot.ownerAccount })</span>
							</>
						) }
					</Row>
					{ bot != null && typeof bot !== 'string' && !!bot.description ? (
						<span className='description fill-x'>{ bot.description.split('\n')[0] }</span>
					) : null }
				</Column>
			</Button>
		</SelectionIndicator>
	);
}
