import classNames from 'classnames';
import { Immutable } from 'immer';
import { noop } from 'lodash-es';
import {
	AccountId,
	AssertNever,
	AssertNotNullable,
	CloneDeepMutable,
	EMPTY,
	FormatTimeInterval,
	GetLogger,
	IDirectoryShardInfo,
	IsAuthorized,
	LIMIT_SPACE_DESCRIPTION_LENGTH,
	LIMIT_SPACE_ENTRYTEXT_LENGTH,
	LIMIT_SPACE_MAX_CHARACTER_NUMBER,
	LIMIT_SPACE_NAME_LENGTH,
	SpaceBaseInfoSchema,
	SpaceDirectoryConfig,
	SpaceDirectoryConfigSchema,
	SpaceGhostManagementConfigSchema,
	SpaceId,
	SpaceInvite,
	SpacePublicSettingSchema,
	ZodMatcher,
	type AssetFrameworkGlobalState,
	type CurrentSpaceInfo,
	type IDirectoryAccountInfo,
	type RoomBackgroundData,
	type SpaceGhostManagementConfig,
} from 'pandora-common';
import React, { ReactElement, ReactNode, useCallback, useEffect, useId, useMemo, useReducer, useRef, useState } from 'react';
import { Navigate } from 'react-router';
import { toast } from 'react-toastify';
import { GetAssetsSourceUrl } from '../../../assets/assetManager.tsx';
import { CopyToClipboard } from '../../../common/clipboard.ts';
import { useCurrentTime } from '../../../common/useCurrentTime.ts';
import { useAsyncEvent } from '../../../common/useEvent.ts';
import { Checkbox } from '../../../common/userInteraction/checkbox.tsx';
import { NumberInput } from '../../../common/userInteraction/input/numberInput.tsx';
import { TextInput } from '../../../common/userInteraction/input/textInput.tsx';
import { Select } from '../../../common/userInteraction/select/select.tsx';
import { Button } from '../../../components/common/button/button.tsx';
import { Column, Row } from '../../../components/common/container/container.tsx';
import { Tab, TabContainer } from '../../../components/common/tabs/tabs.tsx';
import { ModalDialog, useConfirmDialog } from '../../../components/dialog/dialog.tsx';
import {
	useDirectoryChangeListener,
	useDirectoryConnector,
} from '../../../components/gameContext/directoryConnectorContextProvider.tsx';
import { IsSpaceAdmin, useGameState, useGlobalState, useSpaceInfo } from '../../../components/gameContext/gameStateContextProvider.tsx';
import { usePlayer } from '../../../components/gameContext/playerContextProvider.tsx';
import { ContextHelpButton } from '../../../components/help/contextHelpButton.tsx';
import { SelectSettingInput } from '../../../components/settings/helpers/settingsInputs.tsx';
import { WardrobeActionContextProvider } from '../../../components/wardrobe/wardrobeActionContext.tsx';
import { DirectoryConnector } from '../../../networking/directoryConnector.ts';
import { PersistentToast, TOAST_OPTIONS_ERROR } from '../../../persistentToast.ts';
import { useNavigatePandora } from '../../../routing/navigate.ts';
import { useCurrentAccount } from '../../../services/accountLogic/accountManagerHooks.ts';
import { AccountListInput } from '../../components/accountListInput/accountListInput.tsx';
import { BackgroundSelectDialog } from './backgroundSelect.tsx';
import './spaceConfiguration.scss';
import { SPACE_DESCRIPTION_TEXTBOX_SIZE, SPACE_FEATURES } from './spaceConfigurationDefinitions.tsx';
import { SpaceOwnershipRemoval } from './spaceOwnershipRemoval.tsx';

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
		ghostManagement: null,
	};
}

export function SpaceCreate(): ReactElement {
	return <SpaceConfiguration creation />;
}

export function SpaceConfiguration({ creation = false }: { creation?: boolean; } = {}): ReactElement | null {
	const navigate = useNavigatePandora();
	const create = useCreateSpace();
	const directoryConnector = useDirectoryConnector();

	const currentAccount = useCurrentAccount();
	AssertNotNullable(currentAccount);
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

	const isPlayerAdmin = creation || currentSpaceInfo == null || IsSpaceAdmin(currentSpaceInfo.config, currentAccount);
	const canEdit = isPlayerAdmin && (creation || currentSpaceInfo?.id != null);

	const [modifiedData, updateConfig] = useReducer((oldState: Partial<SpaceDirectoryConfig>, action: Partial<SpaceDirectoryConfig>) => {
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
	const [showCommitDialog, setShowCommitDialog] = useState(false);

	const currentConfig = useMemo((): Immutable<SpaceDirectoryConfig> => canEdit ? ({
		...(currentSpaceInfo?.config ?? DefaultConfig()),
		...modifiedData,
	}) : (currentSpaceInfo?.config ?? DefaultConfig()), [canEdit, currentSpaceInfo, modifiedData]);

	const close = useCallback(() => {
		navigate(creation ? '/spaces/search' : '/room');
	}, [creation, navigate]);

	const [commit, processingCommit] = useAsyncEvent(async () => {
		if (creation) {
			await create(CloneDeepMutable(currentConfig));
		} else {
			UpdateSpace(directoryConnector, modifiedData, () => navigate('/room'));
		}
	}, null);

	const onCloseClick = useCallback(() => {
		// If there is no pending modification, close immediately
		if (!canEdit || Object.keys(modifiedData).length === 0) {
			close();
			return;
		}
		// Otherwise show close confirmation dialog
		setShowCommitDialog(true);
	}, [canEdit, close, modifiedData]);

	const tabProps: SpaceConfigurationTabProps = {
		creation,
		canEdit,
		currentConfig,
		updateConfig,
		currentAccount,
		currentSpaceInfo,
		isPlayerAdmin,
	};

	if (!creation && currentSpaceInfo != null && currentSpaceInfo.id !== lastSpaceId.current) {
		// If space id changes abruptly, navigate to default view (this is likely some form of kick or the space stopping to exist)
		return <Navigate to='/' />;
	} else if (creation && isInPublicSpace) {
		// If in a public space, you cannot make a new space directly (as you need to leave first)
		return <Navigate to='/room' />;
	}

	return (
		<div
			className={ classNames(
				'spaceConfigurationScreen',
				creation ? 'creation' : 'configuration',
			) }
		>
			<TabContainer className='flex-1' allowWrap>
				<Tab name='General'>
					<SpaceConfigurationTab { ...tabProps } element={ SpaceConfigurationGeneral } />
				</Tab>
				<Tab name='Rights management'>
					<SpaceConfigurationTab { ...tabProps } element={ SpaceConfigurationRights } />
				</Tab>
				<Tab name='Room management'>
					<SpaceConfigurationTab { ...tabProps } element={ SpaceConfigurationRoom } />
				</Tab>
				{
					currentConfig.features.includes('development') && isDeveloper ? (
						<Tab name='Development settings'>
							<SpaceConfigurationTab { ...tabProps } element={ SpaceConfigurationDebug } />
						</Tab>
					) : null
				}
				<Tab name='◄ Close' tabClassName='slim' onClick={ onCloseClick } />
			</TabContainer>
			{
				creation ? (
					<Column padding='medium' alignX='center'>
						<Button className='creationButton'
							onClick={ commit }
							disabled={ processingCommit }
						>
							Create space
						</Button>
					</Column>
				) : null
			}
			{
				showCommitDialog ? (
					<ModalDialog>
						<Column>
							<h2>Unsaved changes</h2>
							{
								creation ? (
									<p>Create a space with this configuration?</p>
								) : (
									<p>Confirm your changes to the space's configuration?</p>
								)
							}
							<Row wrap gap='large' alignY='center'>
								<Button
									onClick={ close }
									disabled={ processingCommit }
								>
									Discard all changes
								</Button>
								<Button
									slim
									onClick={ () => {
										setShowCommitDialog(false);
									} }
									disabled={ processingCommit }
								>
									Edit the configuration further
								</Button>
								<Button
									onClick={ commit }
									disabled={ processingCommit }
								>
									{ creation ? 'Create space' : 'Update space' }
								</Button>
							</Row>
						</Column>
					</ModalDialog>
				) : null
			}
		</div>
	);
}

type SpaceConfigurationTabProps = {
	creation: boolean;
	canEdit: boolean;
	currentConfig: Immutable<SpaceDirectoryConfig>;
	updateConfig: (update: Partial<SpaceDirectoryConfig>) => void;
	currentAccount: IDirectoryAccountInfo;
	isPlayerAdmin: boolean;
	currentSpaceInfo: Immutable<CurrentSpaceInfo> | null;
};

function SpaceConfigurationTab({ element: Element, ...props }: SpaceConfigurationTabProps & { element: (props: SpaceConfigurationTabProps) => ReactElement | null; }): ReactElement {
	return (
		<div className='tab-wrapper'>
			<Column className='flex-1' alignX='center'>
				<Column className='flex-grow-1' alignY='center' padding='large' gap='large'>
					<Element { ...props } />
				</Column>
			</Column>
		</div>
	);
}

function SpaceConfigurationGeneral({
	creation,
	canEdit,
	currentConfig,
	updateConfig,
}: SpaceConfigurationTabProps): ReactElement {
	const idPrefix = useId();
	const currentAccount = useCurrentAccount();
	const isDeveloper = currentAccount?.roles !== undefined && IsAuthorized(currentAccount.roles, 'developer');

	let spaceFeatures = SPACE_FEATURES;

	if (!isDeveloper) {
		spaceFeatures = spaceFeatures.filter((x) => {
			return x.id !== 'development';
		});
	}

	return (
		<>
			<fieldset>
				<legend>Space size</legend>
				<div className='input-container'>
					<label>(maximum number of characters allowed inside - from 1 to { LIMIT_SPACE_MAX_CHARACTER_NUMBER })</label>
					<NumberInput
						autoComplete='none'
						value={ currentConfig.maxUsers }
						min={ 1 }
						max={ LIMIT_SPACE_MAX_CHARACTER_NUMBER }
						readOnly={ !canEdit }
						onChange={ (newValue) => updateConfig({ maxUsers: newValue }) }
					/>
				</div>
			</fieldset>
			<fieldset>
				<legend>Space visibility</legend>
				<div className='input-container'>
					<label>
						Finding and accessing this space
						<ContextHelpButton>
							<p>
								This setting affects who can see and enter this space.<br />
								It has the following options:
							</p>
							<h3>Locked</h3>
							<ul>
								<li>Owners, Admins and "Allowed users" users can see this space.</li>
								<li>Owners and Admins can join at any time. They are asked for confirmation before entering.</li>
								<li>"Join-me" invitations can be created only by Owners and Admins. Anyone can join using them.</li>
								<li>"Space-bound" invitations cannot be used. Existing space-bound invitations are kept for when the space is unlocked.</li>
							</ul>
							<h3>Private</h3>
							<ul>
								<li>Owners, Admins and "Allowed users" users can see this space.</li>
								<li>Owners, Admins and "Allowed users" users can join at any time.</li>
								<li>"Join-me" invitations can be created only by Owners and Admins. Anyone can join using them.</li>
								<li>"Space-bound" invitations can be used to join.</li>
							</ul>
							<h3>Public while an admin is inside</h3>
							<ul>
								<li>Anyone can see this space while there currently is an <strong>online admin</strong> inside. Otherwise only Owners, Admins and "Allowed users" users can see it.</li>
								<li>Anyone non-banned who can see this space can join at any time.</li>
								<li>"Join-me" invitations can be created and used by anyone.</li>
								<li>"Space-bound" invitations can be used to join.</li>
							</ul>
							<h3>Public</h3>
							<ul>
								<li>Anyone can see this space while there currently is <strong>any online character</strong> inside. Otherwise only Owners, Admins and "Allowed users" users can see it.</li>
								<li>Anyone non-banned who can see this space can join at any time.</li>
								<li>"Join-me" invitations can be created and used by anyone.</li>
								<li>"Space-bound" invitations can be used to join.</li>
							</ul>
						</ContextHelpButton>
					</label>
					<Select
						className='contain-size'
						value={ currentConfig.public }
						onChange={ (e) => updateConfig({ public: SpacePublicSettingSchema.parse(e.target.value) }) }
						noScrollChange
						disabled={ !canEdit }
					>
						<option value='locked'>Locked</option>
						<option value='private'>Private</option>
						<option value='public-with-admin'>Public while an admin is inside</option>
						<option value='public-with-anyone'>Public</option>
					</Select>
				</div>
			</fieldset>
			<fieldset>
				<legend>Space presentation</legend>
				<div className='input-container'>
					<label>Space name ({ currentConfig.name.length }/{ LIMIT_SPACE_NAME_LENGTH } characters)</label>
					<TextInput
						autoComplete='none'
						value={ currentConfig.name }
						onChange={ (newValue) => updateConfig({ name: newValue }) }
						readOnly={ !canEdit }
					/>
					{ canEdit && !IsValidName(currentConfig.name) ? (<div className='error'>Invalid name</div>) : null }
				</div>
				<div className='input-container'>
					<label>Space description ({ currentConfig.description.length }/{ LIMIT_SPACE_DESCRIPTION_LENGTH } characters)</label>
					<textarea
						value={ currentConfig.description }
						onChange={ (event) => updateConfig({ description: event.target.value }) }
						readOnly={ !canEdit }
						rows={ SPACE_DESCRIPTION_TEXTBOX_SIZE }
					/>
					{ canEdit && !IsValidDescription(currentConfig.description) ? (<div className='error'>Invalid description</div>) : null }
				</div>
				<div className='input-container'>
					<label>
						Entry message
						<ContextHelpButton>
							<p>
								This text is shown to a new player entering the space.<br />
								Use it for a narrative, instructions, or to describe special features<br />
								of the room, like things that are not shown, smells, temperature and so on.
							</p>
						</ContextHelpButton>
						({ currentConfig.entryText.length }/{ LIMIT_SPACE_ENTRYTEXT_LENGTH } characters)
					</label>
					<textarea
						value={ currentConfig.entryText }
						onChange={ (event) => updateConfig({ entryText: event.target.value }) }
						readOnly={ !canEdit }
						rows={ ENTRY_TEXT_TEXTBOX_SIZE }
					/>
					{ canEdit && !IsValidEntryText(currentConfig.entryText) ? (<div className='error'>Invalid entry text</div>) : null }
				</div>
			</fieldset>
			{
				creation ? (
					<div className='input-container'>
						<label>Features (cannot be changed after creation):</label>
						{
							spaceFeatures.map((feature) => (
								<div key={ feature.id }>
									<Checkbox
										id={ `${idPrefix}-feature-${feature.id}` }
										checked={ currentConfig.features.includes(feature.id) }
										onChange={ (newValue) => {
											if (newValue) {
												if (!currentConfig.features.includes(feature.id)) {
													updateConfig({ features: [...currentConfig.features, feature.id] });
												}
											} else {
												updateConfig({ features: currentConfig.features.filter((f) => f !== feature.id) });
											}
										} }
									/>
									<label htmlFor={ `${idPrefix}-feature-${feature.id}` }> { feature.name }</label>
								</div>
							))
						}
					</div>
				) : (
					<div className='input-container'>
						<label>Features (cannot be changed after creation):</label>
						<ul>
							{
								currentConfig.features.length > 0 ?
								SPACE_FEATURES
									.filter((feature) => currentConfig.features.includes(feature.id))
									.map((feature) => (
										<li key={ feature.id }>{ feature.name }</li>
									))
								:
								'- None'
							}
						</ul>
					</div>
				)
			}
		</>
	);
}

function SpaceConfigurationRights({
	creation,
	canEdit,
	currentConfig,
	updateConfig,
	currentAccount,
	currentSpaceInfo,
	isPlayerAdmin,
}: SpaceConfigurationTabProps): ReactElement {
	const idPrefix = useId();

	const accountId = currentAccount.id;
	const owners: readonly AccountId[] = useMemo(() => (
		creation ? [accountId] : (currentSpaceInfo?.config.owners ?? [])
	), [creation, accountId, currentSpaceInfo]);
	const isPlayerOwner = !!(creation || accountId && currentSpaceInfo?.config.owners.includes(accountId));

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

	return (
		<>
			<fieldset>
				<legend>Ownership</legend>
				<div className='input-container'>
					<label>Owners</label>
					<Row>
						<Column className='flex-1'>
							<AccountListInput
								value={ owners }
								allowSelf
							/>
						</Column>
						{ !creation && currentSpaceInfo?.id != null && isPlayerOwner ? <SpaceOwnershipRemoval id={ currentSpaceInfo.id } name={ currentSpaceInfo.config.name } /> : null }
					</Row>
				</div>
			</fieldset>
			<fieldset>
				<legend>Admins</legend>
				<div className='input-container'>
					<AccountListInput
						value={ currentConfig.admin }
						onChange={ canEdit ? ((admin) => updateConfig({ admin: admin.slice() })) : undefined }
						allowSelf
					/>
				</div>
			</fieldset>
			<fieldset>
				<legend>Banned users</legend>
				<div className='input-container'>
					<AccountListInput
						value={ currentConfig.banned }
						onChange={ canEdit ? ((banned) => updateConfig({ banned: banned.slice() })) : undefined }
						allowSelf
					/>
					<NumberListWarning values={ currentConfig.banned } invalid={ invalidBans } />
				</div>
			</fieldset>
			<fieldset>
				<legend>
					<span>Allowed users</span>
					<ContextHelpButton>
						<p>
							"Allowed users" have special access rights to this space.<br />
						</p>
						<ul>
							<li>They can always see this space in their list of spaces, even while it is empty.</li>
							<li>They can always join the space while it is public or private.</li>
							<li>They can see who is currently inside without joining, unless the space is locked.</li>
							<li>They also cannot join the space while it is locked.</li>
						</ul>
					</ContextHelpButton>
				</legend>
				<div className='input-container'>
					<AccountListInput
						value={ currentConfig.allow }
						onChange={ canEdit ? ((allow) => updateConfig({ allow: allow.slice() })) : undefined }
						allowSelf
					/>
					<NumberListWarning values={ currentConfig.allow } invalid={ invalidAllow } />
				</div>
			</fieldset>
			<fieldset>
				<legend>Offline character management</legend>
				<Column>
					<Row>
						<Checkbox
							id={ `${idPrefix}-ghostmanagement-enable` }
							checked={ currentConfig.ghostManagement != null }
							onChange={ (newValue) => {
								updateConfig({
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
											updateConfig({ ghostManagement: newConfig });
										} }
										canEdit={ canEdit }
									/>
								) : null
					}
				</Column>
			</fieldset>
			{ (!creation && currentSpaceInfo?.id != null) && <SpaceInvites spaceId={ currentSpaceInfo.id } isPlayerAdmin={ isPlayerAdmin } /> }
		</>
	);
}

function SpaceConfigurationRoom({
	creation,
	currentSpaceInfo,
}: SpaceConfigurationTabProps): ReactElement {
	const player = usePlayer();
	AssertNotNullable(player);
	const gameState = useGameState();
	const globalState = useGlobalState(gameState);

	if (creation || currentSpaceInfo == null || globalState.room.spaceId !== currentSpaceInfo.id) {
		return (
			<strong>Room configuration can only be changed from inside the space</strong>
		);
	}

	return (
		<WardrobeActionContextProvider player={ player }>
			<SpaceConfigurationRoomInner
				globalState={ globalState }
			/>
		</WardrobeActionContextProvider>
	);
}

type SpaceConfigurationRoomInnerProps = {
	globalState: AssetFrameworkGlobalState;
};

function SpaceConfigurationRoomInner({
	globalState,
}: SpaceConfigurationRoomInnerProps): ReactElement {
	const [showBackgrounds, setShowBackgrounds] = useState(false);

	return (
		<fieldset>
			<legend>Room background</legend>
			{ showBackgrounds && <BackgroundSelectDialog
				hide={ () => setShowBackgrounds(false) }
				current={ globalState.room.roomGeometryConfig }
			/> }
			<Column>
				<BackgroundInfo background={ globalState.room.roomBackground } />
				<Button
					onClick={ () => setShowBackgrounds(true) }
				>
					Select a background
				</Button>
			</Column>
		</fieldset>
	);
}

function SpaceConfigurationDebug({
	currentConfig,
	updateConfig,
}: SpaceConfigurationTabProps): ReactElement {
	const shards = useShards();

	useEffect(() => {
		if (shards && currentConfig.development?.shardId && !shards.some((s) => s.id === currentConfig.development?.shardId)) {
			const newDevelopment = CloneDeepMutable(currentConfig.development);
			delete newDevelopment.shardId;
			updateConfig({ development: newDevelopment });
		}
	}, [currentConfig, shards, updateConfig]);

	return (
		<div className='input-container'>
			<h3>Development settings</h3>
			<label>Shard for space</label>
			<Select disabled={ !shards } value={ currentConfig.development?.shardId ?? '[Auto]' } onChange={
				(event) => {
					const value = event.target.value;
					updateConfig({
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
						updateConfig({
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
						updateConfig({
							development: {
								...currentConfig.development,
								disableSafemodeCooldown: newValue,
							},
						});
					} }
				/>
			</div>
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
			<Column gap='small'>
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
				driver={ {
					currentValue: config.ignore,
					defaultValue: 'admin',
					onChange(newValue) {
						setConfig({
							...config,
							ignore: newValue,
						});
					},
				} }
				label='Ignore characters that are'
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
		<fieldset>
			<legend>Space invites management</legend>
			<Column gap='large'>
				<Column gap='medium'>
					<div onClick={ copyPublic } className='permanentInvite'>
						<span className='text'>Permanent public invite link:</span>
						<span className='invite'>{ permaLink }</span>
					</div>
					<Button onClick={ () => setShowCreation(true) }>Create New Invite</Button>
				</Column>
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
		</fieldset>
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

function NumberListWarning({ values, invalid }: {
	values: readonly number[];
	invalid: { note: string; when: { reason: string; list: readonly number[]; }[]; };
}): ReactElement | null {
	const invalidWarning = useMemo(() => {
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

	if (!invalidWarning) {
		return null;
	}

	return (
		<Column gap='none'>{ invalidWarning }</Column>
	);
}

function BackgroundInfo({ background }: { background: Immutable<RoomBackgroundData>; }): ReactElement | null {
	if (background.graphics.type !== 'image' || background.graphics.image.startsWith('#')) {
		return null;
	}

	return (
		<Row alignX='center' className='backgroundInfo'>
			<div className='preview'>
				<img src={ GetAssetsSourceUrl() + background.graphics.image } />
			</div>
		</Row>
	);
}

const SpaceConfigurationProgress = new PersistentToast();

function useCreateSpace(): (config: SpaceDirectoryConfig) => Promise<void> {
	const directoryConnector = useDirectoryConnector();
	const navigate = useNavigatePandora();
	return useCallback(async (config) => {
		const validatedConfig = SpaceDirectoryConfigSchema.safeParse(config);
		if (!validatedConfig.success) {
			const issue = validatedConfig.error.issues.length > 0 ? validatedConfig.error.issues[0] : undefined;
			SpaceConfigurationProgress.show('error', `Error during space creation:\nInvalid data${issue ? (`:\n\t"${issue.path.join('/')}" ${issue.message}`) : ''}`);
			return;
		}
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
