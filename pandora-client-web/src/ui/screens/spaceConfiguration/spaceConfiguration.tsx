import { Immutable } from 'immer';
import { noop, uniq } from 'lodash-es';
import {
	AccountId,
	AssertNever,
	AssertNotNullable,
	AssetManager,
	CloneDeepMutable,
	DEFAULT_BACKGROUND,
	EMPTY,
	FormatTimeInterval,
	GetLogger,
	IDirectoryShardInfo,
	IsAuthorized,
	IsObject,
	LIMIT_SPACE_DESCRIPTION_LENGTH,
	LIMIT_SPACE_ENTRYTEXT_LENGTH,
	LIMIT_SPACE_MAX_CHARACTER_NUMBER,
	LIMIT_SPACE_NAME_LENGTH,
	RoomBackgroundInfo,
	RoomBackgroundTagDefinition,
	SpaceBaseInfoSchema,
	SpaceDirectoryConfig,
	SpaceFeature,
	SpaceGhostManagementConfigSchema,
	SpaceId,
	SpaceInvite,
	SpacePublicSettingSchema,
	ZodMatcher,
	type CurrentSpaceInfo,
	type SpaceGhostManagementConfig,
} from 'pandora-common';
import React, { ReactElement, ReactNode, useCallback, useEffect, useId, useMemo, useReducer, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router';
import { toast } from 'react-toastify';
import { GetAssetsSourceUrl, useAssetManager } from '../../../assets/assetManager.tsx';
import { CopyToClipboard } from '../../../common/clipboard.ts';
import { useCurrentTime } from '../../../common/useCurrentTime.ts';
import { useAsyncEvent } from '../../../common/useEvent.ts';
import { Checkbox } from '../../../common/userInteraction/checkbox.tsx';
import { NumberInput } from '../../../common/userInteraction/input/numberInput.tsx';
import { TextInput } from '../../../common/userInteraction/input/textInput.tsx';
import { useInputAutofocus } from '../../../common/userInteraction/inputAutofocus.ts';
import { Select } from '../../../common/userInteraction/select/select.tsx';
import { Button } from '../../../components/common/button/button.tsx';
import { ColorInput } from '../../../components/common/colorInput/colorInput.tsx';
import { Column, Row } from '../../../components/common/container/container.tsx';
import { FieldsetToggle } from '../../../components/common/fieldsetToggle/index.tsx';
import { SelectionIndicator } from '../../../components/common/selectionIndicator/selectionIndicator.tsx';
import { Tab, TabContainer } from '../../../components/common/tabs/tabs.tsx';
import { ModalDialog, useConfirmDialog } from '../../../components/dialog/dialog.tsx';
import {
	useDirectoryChangeListener,
	useDirectoryConnector,
} from '../../../components/gameContext/directoryConnectorContextProvider.tsx';
import { IsSpaceAdmin, useSpaceInfo } from '../../../components/gameContext/gameStateContextProvider.tsx';
import { ContextHelpButton } from '../../../components/help/contextHelpButton.tsx';
import { SelectSettingInput } from '../../../components/settings/helpers/settingsInputs.tsx';
import bodyChange from '../../../icons/body-change.svg';
import devMode from '../../../icons/developer.svg';
import { DirectoryConnector } from '../../../networking/directoryConnector.ts';
import { PersistentToast, TOAST_OPTIONS_ERROR } from '../../../persistentToast.ts';
import { useNavigatePandora } from '../../../routing/navigate.ts';
import { useCurrentAccount } from '../../../services/accountLogic/accountManagerHooks.ts';
import './spaceConfiguration.scss';

export const DESCRIPTION_TEXTBOX_SIZE = 16;
const IsValidName = ZodMatcher(SpaceBaseInfoSchema.shape.name);
const IsValidDescription = ZodMatcher(SpaceBaseInfoSchema.shape.description);
const IsValidEntryText = ZodMatcher(SpaceBaseInfoSchema.shape.entryText);
const ENTRY_TEXT_TEXTBOX_SIZE = 8;

function DefaultConfig(): SpaceDirectoryConfig {
	return {
		name: '',
		description: '',
		entryText: '',
		maxUsers: 10,
		admin: [],
		banned: [],
		allow: [],
		public: 'private',
		features: [],
		background: CloneDeepMutable(DEFAULT_BACKGROUND),
		ghostManagement: null,
	};
}

export const SPACE_FEATURES: { id: SpaceFeature; name: string; icon: string; }[] = [
	{
		id: 'allowBodyChanges',
		name: 'Allow changes to character bodies',
		icon: bodyChange,
	},
	{
		id: 'development',
		name: 'Development mode',
		icon: devMode,
	},
];

export function SpaceCreate(): ReactElement {
	return <SpaceConfiguration creation />;
}

export function SpaceConfiguration({ creation = false }: { creation?: boolean; } = {}): ReactElement | null {
	const idPrefix = useId();

	const navigate = useNavigatePandora();
	const currentAccount = useCurrentAccount();
	AssertNotNullable(currentAccount);
	const create = useCreateSpace();
	let currentSpaceInfo: Immutable<CurrentSpaceInfo> | null = useSpaceInfo();
	const lastSpaceId = useRef<SpaceId>(null);
	const isInPublicSpace = currentSpaceInfo.id != null;
	const isDeveloper = currentAccount?.roles !== undefined && IsAuthorized(currentAccount.roles, 'developer');
	if (creation) {
		currentSpaceInfo = null;
	} else {
		// Remember which space we were opened into - that way we can exit the screen if it changes abruptly
		if (lastSpaceId.current == null) {
			lastSpaceId.current = currentSpaceInfo.id;
		}
	}
	const [modifiedData, setModifiedData] = useReducer((oldState: Partial<SpaceDirectoryConfig>, action: Partial<SpaceDirectoryConfig>) => {
		const result: Partial<SpaceDirectoryConfig> = {
			...oldState,
			...action,
		};
		if (!creation) {
			delete result.features;
			delete result.development;
		} else if (result.features) {
			if (result.features.includes('development') && isDeveloper && !result.development) {
				result.development = {};
			} else if (!result.features.includes('development') || !isDeveloper) {
				delete result.development;
			}
		}
		return result;
	}, {});
	const directoryConnector = useDirectoryConnector();
	const shards = useShards();
	const accountId = currentAccount.id;
	const [showBackgrounds, setShowBackgrounds] = useState(false);

	const currentConfig: SpaceDirectoryConfig = useMemo(() => ({
		...(CloneDeepMutable(currentSpaceInfo?.config ?? DefaultConfig())),
		...modifiedData,
	}), [currentSpaceInfo, modifiedData]);
	const currentSpaceId: SpaceId | null = currentSpaceInfo?.id ?? null;

	const isPlayerOwner = !!(creation || accountId && currentSpaceInfo?.config.owners.includes(accountId));
	const isPlayerAdmin = creation || currentSpaceInfo == null || IsSpaceAdmin(currentSpaceInfo.config, currentAccount);
	const canEdit = isPlayerAdmin && (creation || currentSpaceId != null);

	const owners: readonly AccountId[] = useMemo(() => (
		creation ? [accountId] : (currentSpaceInfo?.config.owners ?? [])
	), [creation, accountId, currentSpaceInfo]);

	const currentConfigBackground = currentConfig.background;

	const invalidBans = useMemo(() => ({
		note: 'Owners and admins will be removed from the ban list automatically.',
		when: [
			{ reason: 'Already an owner', list: owners },
			{ reason: 'Already an admin', list: currentConfig.admin },
		],
	}), [owners, currentConfig.admin]);
	const invalidAllow = useMemo(() => ({
		note: 'Owners and admins and banned users will be removed from the allow list automatically.',
		when: [
			{ reason: 'Already an owner', list: owners },
			{ reason: 'Already an admin', list: currentConfig.admin },
			{ reason: 'Already banned', list: currentConfig.banned },
		],
	}), [owners, currentConfig.admin, currentConfig.banned]);

	if (!creation && currentSpaceInfo != null && currentSpaceInfo.id !== lastSpaceId.current) {
		// If space id changes abruptly, navigate to default view (this is likely some form of kick or the space stopping to exist)
		return <Navigate to='/' />;
	} else if (creation && isInPublicSpace) {
		// If in a public space, you cannot make a new space directly (as you need to leave first)
		return <Navigate to='/room' />;
	}

	if (shards && currentConfig.development?.shardId && !shards.some((s) => s.id === currentConfig.development?.shardId)) {
		delete currentConfig.development.shardId;
	}

	const configurableElements = (
		<>
			<div className='input-container'>
				<label>Space name ({ currentConfig.name.length }/{ LIMIT_SPACE_NAME_LENGTH } characters)</label>
				<TextInput
					autoComplete='none'
					value={ currentConfig.name }
					onChange={ (newValue) => setModifiedData({ name: newValue }) }
					readOnly={ !canEdit }
				/>
				{ canEdit && !IsValidName(currentConfig.name) ? (<div className='error'>Invalid name</div>) : null }
			</div>
			<div className='input-container'>
				<label>Space size (maximum number of characters allowed inside - from 1 to { LIMIT_SPACE_MAX_CHARACTER_NUMBER })</label>
				<NumberInput
					autoComplete='none'
					value={ currentConfig.maxUsers }
					min={ 1 }
					max={ LIMIT_SPACE_MAX_CHARACTER_NUMBER }
					readOnly={ !canEdit }
					onChange={ (newValue) => setModifiedData({ maxUsers: newValue }) }
				/>
			</div>
			<FieldsetToggle legend='Presentation and access'>
				<div className='input-container'>
					<label>Space description ({ currentConfig.description.length }/{ LIMIT_SPACE_DESCRIPTION_LENGTH } characters)</label>
					<textarea
						value={ currentConfig.description }
						onChange={ (event) => setModifiedData({ description: event.target.value }) }
						readOnly={ !canEdit }
						rows={ DESCRIPTION_TEXTBOX_SIZE }
					/>
					{ canEdit && !IsValidDescription(currentConfig.description) ? (<div className='error'>Invalid description</div>) : null }
				</div>
				<div className='input-container'>
					<label>
						Entry text
						<ContextHelpButton>
							<p>
								This text is shown to a new player entering the space.<br />
								Use it to describe special features of the room, <br />
								like things that are not shown, smells, temperature and so on.
							</p>
						</ContextHelpButton>
						({ currentConfig.entryText.length }/{ LIMIT_SPACE_ENTRYTEXT_LENGTH } characters)
					</label>
					<textarea
						value={ currentConfig.entryText }
						onChange={ (event) => setModifiedData({ entryText: event.target.value }) }
						readOnly={ !canEdit }
						rows={ ENTRY_TEXT_TEXTBOX_SIZE }
					/>
					{ canEdit && !IsValidEntryText(currentConfig.entryText) ? (<div className='error'>Invalid entry text</div>) : null }
				</div>
				<div className='input-container'>
					<label>
						Space visibility
						<ContextHelpButton>
							<p>
								This setting affects who can see and enter this space.<br />
								It has the following options:
							</p>
							<h3>Locked</h3>
							<ul>
								<li>Owners, Admins and Allow-listed users can see this space.</li>
								<li>Owners and Admins can join at any time. They are asked for confirmation before entering.</li>
								<li>"Join-me" invitations can be created only by Owners and Admins. Anyone can join using them.</li>
								<li>"Space-bound" invitations cannot be used. Existing space-bound invitations are kept for when the space is unlocked.</li>
							</ul>
							<h3>Private</h3>
							<ul>
								<li>Owners, Admins and Allow-listed users can see this space.</li>
								<li>Owners, Admins and Allow-listed users can join at any time.</li>
								<li>"Join-me" invitations can be created only by Owners and Admins. Anyone can join using them.</li>
								<li>"Space-bound" invitations can be used to join.</li>
							</ul>
							<h3>Public while an admin is inside</h3>
							<ul>
								<li>Anyone can see this space while there currently is an <strong>online admin</strong> inside. Otherwise only Owners, Admins and Allow-listed users can see it.</li>
								<li>Anyone non-banned who can see this space can join at any time.</li>
								<li>"Join-me" invitations can be created and used by anyone.</li>
								<li>"Space-bound" invitations can be used to join.</li>
							</ul>
							<h3>Public</h3>
							<ul>
								<li>Anyone can see this space while there currently is <strong>any online character</strong> inside. Otherwise only Owners, Admins and Allow-listed users can see it.</li>
								<li>Anyone non-banned who can see this space can join at any time.</li>
								<li>"Join-me" invitations can be created and used by anyone.</li>
								<li>"Space-bound" invitations can be used to join.</li>
							</ul>
						</ContextHelpButton>
					</label>
					<Select
						value={ currentConfig.public }
						onChange={ (e) => setModifiedData({ public: SpacePublicSettingSchema.parse(e.target.value) }) }
						noScrollChange
						disabled={ !canEdit }
					>
						<option value='locked'>Locked</option>
						<option value='private'>Private</option>
						<option value='public-with-admin'>Public while an admin is inside</option>
						<option value='public-with-anyone'>Public</option>
					</Select>
				</div>
			</FieldsetToggle>
			<FieldsetToggle legend='Ownership'>
				<div className='input-container'>
					<label>Owners</label>
					<Row>
						<NumberListArea className='flex-1' values={ owners } setValues={ () => { /* NOOP */ } } readOnly />
						{ !creation && currentSpaceInfo != null && currentSpaceId != null && isPlayerOwner ? <SpaceOwnershipRemoval id={ currentSpaceId } name={ currentSpaceInfo.config.name } /> : null }
					</Row>
				</div>
			</FieldsetToggle>
			<FieldsetToggle legend='Background'>
				{ showBackgrounds && <BackgroundSelectDialog
					hide={ () => setShowBackgrounds(false) }
					current={ currentConfigBackground }
					select={ (background) => setModifiedData({ background }) }
				/> }
				{
					typeof currentConfigBackground === 'string' ? (
						<Column>
							<BackgroundInfo background={ currentConfigBackground } />
							<Button
								onClick={ () => setShowBackgrounds(true) }
								disabled={ !canEdit }
							>
								Select a background
							</Button>
						</Column>
					) : (
						<>
							<div className='input-container'>
								<label>Background color</label>
								<Row alignY='center'>
									<ColorInput
										initialValue={ currentConfigBackground.image.startsWith('#') ? currentConfigBackground.image : '#FFFFFF' }
										onChange={ (color) => setModifiedData({ background: { ...currentConfigBackground, image: color } }) }
										disabled={ !canEdit }
										title='Background'
										classNameTextInput='flex-1'
									/>
								</Row>
							</div>
							<br />
							<Button
								onClick={ () => setShowBackgrounds(true) }
								disabled={ !canEdit }
							>
								Select a background
							</Button>
						</>
					)
				}
			</FieldsetToggle>
		</>
	);

	if (creation) {
		return (
			<div className='spaceConfigurationScreen creation'>
				<Link to='/spaces/search'>◄ Back</Link>
				<p>Space creation</p>
				{ configurableElements }
				<div className='input-container'>
					<label>Features (cannot be changed after creation)</label>
					{
						SPACE_FEATURES.map((feature) => (
							(feature.id !== 'development' || (feature.id === 'development' && isDeveloper)) &&
							<div key={ feature.id }>
								<Checkbox
									id={ `${idPrefix}-feature-${feature.id}` }
									checked={ currentConfig.features.includes(feature.id) }
									onChange={ (newValue) => {
										if (newValue) {
											if (!currentConfig.features.includes(feature.id)) {
												setModifiedData({ features: [...currentConfig.features, feature.id] });
											}
										} else {
											setModifiedData({ features: currentConfig.features.filter((f) => f !== feature.id) });
										}
									} }
								/>
								<label htmlFor={ `${idPrefix}-feature-${feature.id}` }> { feature.name }</label>
							</div>
						))
					}
				</div>
				{
					currentConfig.features.includes('development') && isDeveloper &&
					<div className='input-container'>
						<h3>Development settings</h3>
						<label>Shard for space</label>
						<Select disabled={ !shards } value={ currentConfig.development?.shardId ?? '[Auto]' } onChange={
							(event) => {
								const value = event.target.value;
								setModifiedData({
									development: {
										...currentConfig.development,
										shardId: value === '[Auto]' ? undefined : value,
									},
								});
							}
						}>
							{
								!shards ?
									<option>Loading...</option> :
									<>
										<option key='[Auto]' value='[Auto]' >[Auto]</option>
										{
											shards.map((shard) => <option key={ shard.id } value={ shard.id }>{ shard.id } ({ shard.publicURL }) [v{ shard.version }]</option>)
										}
									</>
							}
						</Select>
						<div className='input-line'>
							<label>Auto admin for developers</label>
							<Checkbox
								checked={ currentConfig.development?.autoAdmin ?? false }
								onChange={ (newValue) => {
									setModifiedData({
										development: {
											...currentConfig.development,
											autoAdmin: newValue,
										},
									});
								} }
							/>
						</div>
						<div className='input-line'>
							<label>Bypass safemode cooldown</label>
							<Checkbox
								checked={ currentConfig.development?.disableSafemodeCooldown ?? false }
								onChange={ (newValue) => {
									setModifiedData({
										development: {
											...currentConfig.development,
											disableSafemodeCooldown: newValue,
										},
									});
								} }
							/>
						</div>
					</div>
				}
				<Button onClick={ () => void create(currentConfig) }>Create space</Button>
			</div>
		);
	}

	return (
		<div className='spaceConfigurationScreen configuration'>
			<TabContainer className='flex-1'>
				<Tab name='General'>
					<div className='spaceConfigurationScreen-tab'>
						<br />
						{ configurableElements }
						<div className='input-container'>
							<label>Features (cannot be changed after creation)</label>
							<ul>
								{
									SPACE_FEATURES
										.filter((feature) => currentConfig.features.includes(feature.id))
										.map((feature) => (
											<li key={ feature.id }>{ feature.name }</li>
										))
								}
							</ul>
						</div>
						{ canEdit && <Button className='fill-x' onClick={ () => UpdateSpace(directoryConnector, modifiedData, () => navigate('/room')) }>Update space</Button> }
					</div>
				</Tab>
				<Tab name='Visitor Management'>
					<div className='spaceConfigurationScreen-tab'>
						<br />
						<FieldsetToggle legend='Permission lists'>
							<div className='input-container'>
								<label>Admins</label>
								<NumberListArea values={ currentConfig.admin } setValues={ (admin) => setModifiedData({ admin }) } readOnly={ !canEdit } />
							</div>
							<div className='input-container'>
								<label>Banned users</label>
								<NumberListArea values={ currentConfig.banned } setValues={ (banned) => setModifiedData({ banned }) } readOnly={ !canEdit } invalid={ invalidBans } />
							</div>
							<div className='input-container'>
								<label>Allowed users</label>
								<NumberListArea values={ currentConfig.allow } setValues={ (allow) => setModifiedData({ allow }) } readOnly={ !canEdit } invalid={ invalidAllow } />
							</div>
						</FieldsetToggle>
						<FieldsetToggle legend='Offline character management'>
							<Column>
								<Row>
									<Checkbox
										id={ `${idPrefix}-ghostmanagement-enable` }
										checked={ currentConfig.ghostManagement != null }
										onChange={ (newValue) => {
											setModifiedData({
												ghostManagement: newValue ? {
													ignore: 'admin',
													timer: 2,
													affectCharactersInRoomDevice: false,
												} : null,
											});
										} }
										disabled={ !canEdit }
									/>
									<label htmlFor={ `${idPrefix}-ghostmanagement-enable` }>Enable automatic offline character removal</label>
								</Row>
								{
									currentConfig.ghostManagement != null ? (
										<GhostManagement
											config={ currentConfig.ghostManagement }
											setConfig={ (newConfig) => {
												setModifiedData({ ghostManagement: newConfig });
											} }
											canEdit={ canEdit }
										/>
									) : null
								}
							</Column>
						</FieldsetToggle>
						{ (!creation && currentSpaceId != null) && <SpaceInvites spaceId={ currentSpaceId } isPlayerAdmin={ isPlayerAdmin } /> }
						<br />
						{ canEdit && <Button className='fill-x' onClick={ () => UpdateSpace(directoryConnector, modifiedData, () => navigate('/room')) }>Update space</Button> }
					</div>
				</Tab>
				<Tab name='◄ Back' tabClassName='slim' onClick={ () => navigate('/room') } />
			</TabContainer>
		</div>
	);
}

function GhostManagement({ config, setConfig, canEdit }: {
	config: SpaceGhostManagementConfig;
	setConfig: (newConfig: SpaceGhostManagementConfig) => void;
	canEdit: boolean;
}): ReactElement {
	const idPrefix = useId();

	return (
		<>
			<Column>
				<label>Autokick offline characters after (minutes)</label>
				<NumberInput
					min={ 0 }
					value={ config.timer }
					onChange={ (newValue) => {
						setConfig({
							...config,
							timer: newValue,
						});
					} }
					readOnly={ !canEdit }
				/>
			</Column>
			<SelectSettingInput<SpaceGhostManagementConfig['ignore']>
				currentValue={ config.ignore }
				defaultValue='admin'
				label='Ignore characters that are'
				onChange={ (newValue) => {
					setConfig({
						...config,
						ignore: newValue,
					});
				} }
				schema={ SpaceGhostManagementConfigSchema.shape.ignore }
				stringify={ {
					none: '[None] (all characters are affected)',
					owner: 'Owner',
					admin: 'Owner or Admin',
					allowed: 'Owner, Admin, or on the Allowlist',
				} }
			/>
			<Row>
				<Checkbox
					id={ `${idPrefix}-ghostmanagement-room-devices` }
					checked={ config.affectCharactersInRoomDevice }
					onChange={ (newValue) => {
						setConfig({
							...config,
							affectCharactersInRoomDevice: newValue,
						});
					} }
					readOnly={ !canEdit }
				/>
				<label htmlFor={ `${idPrefix}-ghostmanagement-room-devices` }>Also affect characters in the slots of room-level items</label>
			</Row>
		</>
	);
}

function SpaceInvites({ spaceId, isPlayerAdmin }: { spaceId: SpaceId; isPlayerAdmin: boolean; }): ReactElement {
	const directoryConnector = useDirectoryConnector();
	const [invites, setInvites] = useState<readonly SpaceInvite[]>([]);
	const [showCreation, setShowCreation] = useState(false);

	const [update] = useAsyncEvent(
		async () => {
			return await directoryConnector.awaitResponse('spaceInvite', { action: 'list' });
		},
		(resp) => {
			if (resp?.result === 'list') {
				setInvites(resp.invites);
			}
		},
	);

	const permaLink = `https://project-pandora.com/space/join/${encodeURIComponent(spaceId)}`;

	const copyPublic = useCallback((ev: React.MouseEvent<HTMLElement>) => {
		ev.stopPropagation();
		CopyToClipboard(permaLink, () => toast('Copied invite to clipboard'));
	}, [permaLink]);

	useEffect(() => {
		update();
	}, [update]);

	const addInvite = useCallback((invite: SpaceInvite) => setInvites((inv) => [...inv, invite]), []);

	return (
		<FieldsetToggle legend='Invites'>
			<Column gap='medium'>
				<div onClick={ copyPublic } className='permanentInvite'>
					<span className='text'>Permanent public invite link:</span>
					<span className='invite'>{ permaLink }</span>
				</div>
				<Button onClick={ () => setShowCreation(true) }>Create New Invite</Button>
				<table className='spaceInvitesTable'>
					<thead>
						<tr>
							<th>Invite ID</th>
							<th>Uses</th>
							<th>Limited To Account</th>
							<th>Limited To Character</th>
							<th>Expires</th>
							<th>Type</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						{
							invites.map((invite) => (
								<SpaceInviteRow key={ invite.id } spaceId={ spaceId } invite={ invite } directoryConnector={ directoryConnector } update={ update } />
							))
						}
					</tbody>
				</table>
				{ showCreation && <SpaceInviteCreation closeDialog={ () => setShowCreation(false) } addInvite={ addInvite } isPlayerAdmin={ isPlayerAdmin } /> }
			</Column>
		</FieldsetToggle>
	);
}

function SpaceInviteCreation({ closeDialog, addInvite, isPlayerAdmin }: { closeDialog: () => void; addInvite: (invite: SpaceInvite) => void; isPlayerAdmin: boolean; }): ReactElement {
	const directoryConnector = useDirectoryConnector();
	const [allowAccount, setAllowAccount] = useState(false);
	const [account, setAccount] = useState(0);
	const [allowCharacter, setAllowCharacter] = useState(false);
	const [character, setCharacter] = useState(0);
	const [allowMaxUses, setAllowMaxUses] = useState(false);
	const [uses, setUses] = useState(1);

	const [onCreate, processing] = useAsyncEvent(
		async () => {
			if (!isPlayerAdmin && !allowAccount) {
				toast('Account Id is required for non-admin invites', TOAST_OPTIONS_ERROR);
				return null;
			}
			return await directoryConnector.awaitResponse('spaceInvite', {
				action: 'create',
				data: {
					accountId: allowAccount ? account : undefined,
					characterId: allowCharacter ? `c${character}` : undefined,
					maxUses: (allowMaxUses && isPlayerAdmin) ? uses : undefined,
					type: isPlayerAdmin ? 'spaceBound' : 'joinMe',
				},
			});
		},
		(resp) => {
			if (resp == null)
				return;

			if (resp.result !== 'created') {
				toast(`Failed to create invite:\n${resp.result}`, TOAST_OPTIONS_ERROR);
				return;
			}

			addInvite(resp.invite);
			closeDialog();
		},
	);

	return (
		<ModalDialog>
			<Column className='spaceInviteCreation' gap='medium'>
				<div className='input-row'>
					<label>Limit To Account ID</label>
					<Checkbox checked={ allowAccount } onChange={ setAllowAccount } />
					<NumberInput min={ 0 } value={ account } onChange={ setAccount } readOnly={ !allowAccount } />
				</div>
				<div className='input-row'>
					<label>Limit To Character ID</label>
					<Checkbox checked={ allowCharacter } onChange={ setAllowCharacter } />
					<NumberInput min={ 0 } value={ character } onChange={ setCharacter } readOnly={ !allowCharacter } />
				</div>
				{
					isPlayerAdmin && (
						<div className='input-row'>
							<label>Max uses</label>
							<Checkbox checked={ allowMaxUses } onChange={ setAllowMaxUses } />
							<NumberInput min={ 1 } value={ uses } onChange={ setUses } readOnly={ !allowMaxUses } />
						</div>
					)
				}
				<Row padding='medium' alignX='space-between'>
					<Button onClick={ closeDialog }>Cancel</Button>
					<Button onClick={ onCreate } disabled={ processing }>Create</Button>
				</Row>
			</Column>
		</ModalDialog>
	);
}

function SpaceInviteRow({ spaceId, invite, directoryConnector, update }: { spaceId: SpaceId; invite: SpaceInvite; directoryConnector: DirectoryConnector; update: () => void; }): ReactElement {
	const confirm = useConfirmDialog();

	const [onDelete, processing] = useAsyncEvent(
		async (ev: React.MouseEvent<HTMLElement>) => {
			ev.stopPropagation();
			if (!await confirm('Are you sure you want to delete this invite?', `Id: ${invite.id}`))
				return null;

			return await directoryConnector.awaitResponse('spaceInvite', { action: 'delete', id: invite.id });
		},
		(resp) => {
			if (resp == null)
				return;

			if (resp.result !== 'ok') {
				toast(`Failed to delete invite:\n${resp.result}`, TOAST_OPTIONS_ERROR);
				return;
			}

			update();
		},
	);

	const copy = useCallback((ev: React.MouseEvent<HTMLElement>) => {
		ev.stopPropagation();
		CopyToClipboard(`https://project-pandora.com/space/join/${encodeURIComponent(spaceId)}?invite=${encodeURIComponent(invite.id)}`, () => toast('Copied invite id to clipboard'));
	}, [spaceId, invite.id]);

	let type: string;
	switch (invite.type) {
		case 'joinMe':
			type = 'Join Me';
			break;
		case 'spaceBound':
			type = 'Space Bound';
			break;
		default:
			AssertNever(invite.type);
	}

	return (
		<tr>
			<td>{ invite.id }</td>
			<td>{ invite.uses } / { invite.maxUses ?? '∞' }</td>
			<td>{ invite.accountId ?? '' }</td>
			<td>{ invite.characterId ?? '' }</td>
			<td>{ invite.expires ? <SpaceInviteExpires expires={ invite.expires } update={ update } /> : 'Never' }</td>
			<td>{ type }</td>
			<td>
				<Row>
					<Button onClick={ copy } disabled={ processing } className='slim'>Copy</Button>
					<Button onClick={ onDelete } disabled={ processing } className='slim'>Delete</Button>
				</Row>
			</td>
		</tr>
	);
}

function SpaceInviteExpires({ expires, update }: { expires: number; update: () => void; }): ReactElement {
	const now = useCurrentTime(1000);

	useEffect(() => {
		if (expires < now)
			update();
	}, [expires, now, update]);

	return (
		<>
			{ FormatTimeInterval(expires - now, 'short') }
		</>
	);
}

export function SpaceOwnershipRemoval({ buttonClassName, ...data }: { id: SpaceId; name: string; buttonClassName?: string; }): ReactElement | null {
	const [state, setState] = useState<boolean>(false);
	return (
		<>
			<Button className={ buttonClassName } onClick={ () => setState(true) }>Give up space ownership</Button>
			{
				state ? (
					<SpaceOwnershipRemovalDialog { ...data } closeDialog={ () => setState(false) } />
				) : (
					null
				)
			}
		</>
	);
}

function SpaceOwnershipRemovalDialog({ id, name, closeDialog }: { id: SpaceId; name: string; closeDialog: () => void; }): ReactElement {
	const directoryConnector = useDirectoryConnector();

	const removeOwnership = useCallback(() => {
		(async () => {
			SpaceConfigurationProgress.show('progress', 'Removing ownership...');
			const result = await directoryConnector.awaitResponse('spaceOwnershipRemove', { id });
			if (result.result === 'ok') {
				SpaceConfigurationProgress.show('success', 'Space ownership removed!');
				closeDialog();
			} else {
				SpaceConfigurationProgress.show('error', `Failed to remove space ownership:\n${result.result}`);
			}
		})()
			.catch((err) => {
				GetLogger('UpdateSpace').warning('Error during space ownership removal', err);
				SpaceConfigurationProgress.show('error', `Error during space ownership removal:\n${err instanceof Error ? err.message : String(err)}`);
			});
	}, [id, closeDialog, directoryConnector]);

	return (
		<ModalDialog priority={ 10 }>
			<p>
				<b>
					Are you sure that you no longer want ownership of this space?
				</b>
			</p>
			<p>
				Space name: { name }<br />
				Space id: { id }
			</p>
			<p>
				Removing yourself as an owner will turn you into an admin instead and free up a space slot in your account's space count limit.<br />
				Note that a space without any owner gets instantly deleted, kicking everyone currently inside it in the process.<br />
				You cannot affect other owners - only an owner can give up their own ownership of a space.
			</p>
			<Row padding='medium' alignX='space-between'>
				<Button onClick={ closeDialog }>Cancel</Button>
				<Button onClick={ removeOwnership }>Remove your ownership!</Button>
			</Row>
		</ModalDialog>
	);
}

function NumberListArea({ values, setValues, readOnly, invalid, ...props }: {
	values: readonly number[];
	setValues: (newValue: number[]) => void;
	readOnly: boolean;
	className?: string;
	invalid?: { note: string; when: { reason: string; list: readonly number[]; }[]; };
}): ReactElement {
	const [text, setText] = useState(values.join(', '));

	const invalidWarning = useMemo(() => {
		if (!invalid)
			return null;

		const result: ReactNode[] = [];

		for (const { reason, list } of invalid.when) {
			const filtered = values.filter((v) => list.includes(v));
			if (filtered.length > 0) {
				result.push(<span className='error' key={ reason }>{ reason }: { filtered.join(', ') }.</span>);
			}
		}

		if (result.length === 0)
			return null;

		result.push(<span key='note' className='note'>{ invalid.note }</span>);

		return result;
	}, [invalid, values]);

	const onChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
		const value = event.target.value;
		const split = value.split(',');
		const last = split[split.length - 1];
		const unique = new Set<number>();
		const rest = split
			.slice(0, split.length - 1)
			.map((str) => Number.parseInt(str.trim(), 10))
			.filter((n) => Number.isInteger(n))
			.filter((n) => n > 0)
			.filter((n) => !unique.has(n) && unique.add(n));

		const lastNumber = Number.parseInt(last.trim(), 10);
		if (Number.isInteger(lastNumber) && lastNumber > 0) {
			if (!unique.has(lastNumber)) {
				rest.push(lastNumber);
				setText(rest.join(', '));
			} else {
				setText(rest.join(', ') + ', ' + lastNumber.toString());
			}
			setValues(rest);
		} else if (last === '' && value[value.length - 1] === ',') {
			setText(rest.join(', ') + ',');
			setValues(rest);
		} else if (last === '') {
			setText(rest.join(','));
			setValues(rest);
		} else {
			setText(rest.join(', ') + ',' + last);
			setValues(rest);
		}
	}, [setValues]);

	return (
		<>
			<textarea value={ text } onChange={ onChange } readOnly={ readOnly } { ...props } />
			{ invalidWarning && <Column gap='none'>{ invalidWarning }</Column> }
		</>
	);
}

function BackgroundInfo({ background }: { background: string; }): ReactElement {
	const assetManager = useAssetManager();
	const backgroundInfo = useMemo(() => assetManager.getBackgrounds().find((b) => b.id === background), [assetManager, background]);

	if (backgroundInfo == null) {
		return (
			<Column className='backgroundInfo'>
				[ ERROR: Unknown background "{ background }" ]
			</Column>
		);
	}

	return (
		<Row alignX='space-between' className='backgroundInfo'>
			<span className='name'>{ backgroundInfo.name }</span>
			<div className='preview'>
				<img src={ GetAssetsSourceUrl() + backgroundInfo.image } />
			</div>
		</Row>
	);
}

function BackgroundSelectDialog({ hide, current, select }: {
	hide: () => void;
	current: string | SpaceDirectoryConfig['background'];
	select: (background: SpaceDirectoryConfig['background']) => void;
}): ReactElement | null {
	const assetManager = useAssetManager();
	const [selectedBackground, setSelectedBackground] = useState(current);

	useEffect(() => {
		setSelectedBackground(current);
	}, [current]);

	const [nameFilter, setNameFilter] = useState('');
	const [selection, setSelection] = useState(() => BackgroundSelectionStateClass.create(assetManager));

	/** Comparator for sorting backgrounds */
	const backgroundSortOrder = useCallback((a: Readonly<RoomBackgroundInfo>, b: Readonly<RoomBackgroundInfo>): number => {
		return a.name.localeCompare(b.name);
	}, []);

	const backgroundsToShow = useMemo(() => {
		const filterParts = nameFilter.toLowerCase().trim().split(/\s+/);
		return selection.backgrounds
			.filter((b) => filterParts.every((f) => b.name.toLowerCase().includes(f)))
			.sort(backgroundSortOrder);
	}, [selection, nameFilter, backgroundSortOrder]);

	const nameFilterInput = useRef<TextInput>(null);
	useInputAutofocus(nameFilterInput);

	return (
		<ModalDialog position='top'>
			<div className='backgroundSelect'>
				<div className='header'>
					<div className='header-filter'>
						<span>Select a background for the room</span>
						<TextInput ref={ nameFilterInput }
							className='input-filter'
							placeholder='Background name…'
							value={ nameFilter }
							onChange={ setNameFilter }
						/>
					</div>
					<div className='header-tags'>
						{
							selection.knownCategories.map((category) => (
								<TagCategoryButton
									key={ category }
									category={ category }
									selection={ selection }
									setSelection={ setSelection }
								/>
							))
						}
					</div>
				</div>
				<div className='backgrounds'>
					{ backgroundsToShow
						.map((b) => (
							<SelectionIndicator key={ b.id }
								padding='tiny'
								selected={ b.id === selectedBackground }
								active={ b.id === current }
							>
								<Button
									className='fill'
									onClick={ () => {
										setSelectedBackground(b.id);
									} }
								>
									<Column
										alignX='center'
										alignY='center'
										className='details fill'
									>
										<div className='preview'>
											<img src={ GetAssetsSourceUrl() + b.preview } />
										</div>
										<div className='name'>{ b.name }</div>
									</Column>
								</Button>
							</SelectionIndicator>
						)) }
				</div>
				<Row className='footer' alignX='space-between' wrap>
					<Button onClick={ hide }>Cancel</Button>
					<Button
						disabled={ IsObject(current) }
						className='hideDisabled'
						onClick={ () => {
							select(CloneDeepMutable(DEFAULT_BACKGROUND));
							hide();
						} }>
						Solid-color background
					</Button>
					<Button
						onClick={ () => {
							select(selectedBackground);
							hide();
						} }
					>
						Confirm
					</Button>
				</Row>
			</div>
		</ModalDialog>
	);
}

type BackgroundTag = Readonly<RoomBackgroundTagDefinition & { id: string; }>;

function TagCategoryButton({ category, selection, setSelection }: {
	category: string;
	selection: BackgroundSelectionStateClass;
	setSelection: (selection: BackgroundSelectionStateClass) => void;
}): ReactElement {
	const selected = selection.isSelectedCategory(category);
	const onClick = useCallback((ev: React.MouseEvent) => {
		ev.preventDefault();
		ev.stopPropagation();
		setSelection(selection.toggleCategory(category));
	}, [category, selection, setSelection]);
	return (
		<div className='dropdown'>
			<Button className='slim dropdown-button' onClick={ onClick }>
				{ category }
				<span>{ selected ? '✓' : ' ' }</span>
			</Button>
			<div className='dropdown-content'>
				{ selection.getTagsByCategory(category).map((tag) => (
					<TagButton key={ tag.id } id={ tag.id } name={ tag.name } selection={ selection } setSelection={ setSelection } />
				)) }
			</div>
		</div>
	);
}

function TagButton({ id, name, selection, setSelection }: {
	id: string;
	name: string;
	selection: BackgroundSelectionStateClass;
	setSelection: (selection: BackgroundSelectionStateClass) => void;
}): ReactElement {
	const selected = selection.isSelectedTag(id);
	const onClick = useCallback((ev: React.MouseEvent) => {
		ev.preventDefault();
		ev.stopPropagation();
		setSelection(selection.toggleTag(id));
	}, [id, selection, setSelection]);
	const onDoubleClick = useCallback((ev: React.MouseEvent) => {
		ev.preventDefault();
		ev.stopPropagation();
		setSelection(selection.fullToggleTag(id));
	}, [id, selection, setSelection]);
	return (
		<a onClick={ onClick } onDoubleClick={ onDoubleClick }>
			<span>{ selected ? '✓' : ' ' }</span>
			{ name }
		</a>
	);
}

const SpaceConfigurationProgress = new PersistentToast();

function useCreateSpace(): (config: SpaceDirectoryConfig) => Promise<void> {
	const directoryConnector = useDirectoryConnector();
	const navigate = useNavigatePandora();
	return useCallback(async (config) => {
		try {
			SpaceConfigurationProgress.show('progress', 'Creating space...');
			const result = await directoryConnector.awaitResponse('spaceCreate', config);
			if (result.result === 'ok') {
				SpaceConfigurationProgress.show('success', 'Space created!');
				navigate('/room');
			} else {
				SpaceConfigurationProgress.show('error', `Failed to create space:\n${result.result}`);
			}
		} catch (err) {
			GetLogger('CreateSpace').warning('Error during space creation', err);
			SpaceConfigurationProgress.show('error', `Error during space creation:\n${err instanceof Error ? err.message : String(err)}`);
		}
	}, [directoryConnector, navigate]);
}

function UpdateSpace(directoryConnector: DirectoryConnector, config: Partial<SpaceDirectoryConfig>, onSuccess?: () => void): void {
	(async () => {
		SpaceConfigurationProgress.show('progress', 'Updating space...');
		const result = await directoryConnector.awaitResponse('spaceUpdate', config);
		if (result.result === 'ok') {
			SpaceConfigurationProgress.show('success', 'Space updated!');
			onSuccess?.();
		} else {
			SpaceConfigurationProgress.show('error', `Failed to update space:\n${result.result}`);
		}
	})()
		.catch((err) => {
			GetLogger('UpdateSpace').warning('Error during space update', err);
			SpaceConfigurationProgress.show('error', `Error during space update:\n${err instanceof Error ? err.message : String(err)}`);
		});
}

function useShards(): IDirectoryShardInfo[] | undefined {
	const [shards, setShards] = useState<IDirectoryShardInfo[]>();
	const directoryConnector = useDirectoryConnector();

	const fetchShardInfo = useCallback(async () => {
		const result = await directoryConnector.awaitResponse('shardInfo', EMPTY);
		if (result && result.shards) {
			setShards(result.shards);
		}
	}, [directoryConnector]);

	useDirectoryChangeListener('shardList', () => {
		fetchShardInfo().catch(noop);
	});

	return shards;
}

interface BackgroundSelectionState {
	readonly availableBackgrounds: readonly Readonly<RoomBackgroundInfo>[];
	readonly availableTags: ReadonlyMap<string, readonly BackgroundTag[]>;
	readonly backgroundTags: ReadonlyMap<string, Readonly<RoomBackgroundTagDefinition>>;
	readonly tagToCategory: ReadonlyMap<string, string>;
	readonly categories: readonly string[];
	readonly selectedCategories: Set<string>;
	readonly selectedTags: ReadonlyMap<string, Set<string>>;
}

class BackgroundSelectionStateClass {
	private readonly state: BackgroundSelectionState;
	public readonly backgrounds: readonly Readonly<RoomBackgroundInfo>[];
	public readonly categories: ReadonlySet<string>;

	public get knownCategories(): readonly string[] {
		return this.state.categories;
	}

	private constructor(state: BackgroundSelectionState) {
		this.state = state;
		this.backgrounds = state.availableBackgrounds.filter((b) => BackgroundSelectionStateClass.isSelected(state, b));
		this.categories = this.state.selectedCategories;
	}

	public static create(assetManager: AssetManager): BackgroundSelectionStateClass {
		const availableBackgrounds = assetManager.getBackgrounds();
		const backgroundTags = assetManager.backgroundTags;
		const categories = uniq([...backgroundTags.values()].map((tag) => tag.category));
		const tagToCategory = new Map<string, string>();
		for (const [id, tag] of backgroundTags.entries()) {
			tagToCategory.set(id, tag.category);
		}
		const availableTags = new Map<string, readonly BackgroundTag[]>();
		const selectedTags = new Map<string, Set<string>>();
		for (const category of categories) {
			selectedTags.set(category, new Set<string>());
			const tags: BackgroundTag[] = [];
			for (const [id, tag] of backgroundTags.entries()) {
				if (tag.category === category) {
					tags.push({ ...tag, id });
				}
			}
			availableTags.set(category, tags);
		}
		return new BackgroundSelectionStateClass({
			availableBackgrounds,
			availableTags,
			backgroundTags,
			tagToCategory,
			categories,
			selectedCategories: new Set<string>(),
			selectedTags,
		});
	}

	public isSelectedCategory(category: string): boolean {
		return this.state.selectedCategories.has(category);
	}

	public isSelectedTag(tag: string): boolean {
		const category = this.state.tagToCategory.get(tag);
		if (!category) {
			return false;
		}
		const tags = this.state.selectedTags.get(category);
		return tags != null && tags.has(tag);
	}

	public toggleTag(tag: string): BackgroundSelectionStateClass {
		const category = this.state.tagToCategory.get(tag);
		if (!category) {
			return this;
		}
		const selected = this.state.selectedTags.get(category);
		if (!selected) {
			return this;
		}
		if (!selected.delete(tag)) {
			selected.add(tag);
			this.state.selectedCategories.add(category);

		} else if (selected.size === 0) {
			this.state.selectedCategories.delete(category);
		}
		return new BackgroundSelectionStateClass(this.state);
	}

	public fullToggleTag(tag: string): BackgroundSelectionStateClass {
		const category = this.state.tagToCategory.get(tag);
		if (!category) {
			return this;
		}
		const selected = this.state.selectedTags.get(category);
		if (!selected) {
			return this;
		}
		this.state.selectedCategories.add(category);
		if (!selected.has(tag)) {
			selected.clear();
			selected.add(tag);
		} else {
			const tags = this.state.availableTags.get(category)!;
			selected.clear();
			for (const t of tags) {
				if (t.id !== tag) {
					selected.add(t.id);
				}
			}
		}
		return new BackgroundSelectionStateClass(this.state);
	}

	public toggleCategory(category: string): BackgroundSelectionStateClass {
		const selected = this.state.selectedTags.get(category);
		if (!selected) {
			return this;
		}
		if (!this.state.selectedCategories.delete(category)) {
			this.state.selectedCategories.add(category);
			const tags = this.state.availableTags.get(category)!;
			for (const t of tags) {
				selected.add(t.id);
			}
		} else {
			selected.clear();
		}
		return new BackgroundSelectionStateClass(this.state);
	}

	public getTagsByCategory(category: string): readonly BackgroundTag[] {
		return this.state.availableTags.get(category) ?? EMPTY_ARRAY;
	}

	private static isSelected(state: BackgroundSelectionState, info: Readonly<RoomBackgroundInfo>): boolean {
		if (state.selectedCategories.size === 0) {
			return true;
		}
		for (const category of state.selectedCategories) {
			const tags = state.selectedTags.get(category);
			if (!tags || !info.tags.some((tag) => tags.has(tag))) {
				return false;
			}
		}
		return true;
	}
}

const EMPTY_ARRAY: readonly [] = Object.freeze([]);
