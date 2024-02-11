import { Immutable } from 'immer';
import { noop } from 'lodash';
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
	LIMIT_SPACE_MAX_CHARACTER_NUMBER,
	LIMIT_SPACE_NAME_LENGTH,
	SpaceBaseInfoSchema,
	SpaceDirectoryConfig,
	SpaceFeature,
	SpaceId,
	SpaceInvite,
	ZodMatcher,
} from 'pandora-common';
import React, { ReactElement, ReactNode, useCallback, useEffect, useId, useMemo, useReducer, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { CopyToClipboard } from '../../../common/clipboard';
import { useCurrentTime } from '../../../common/useCurrentTime';
import { useAsyncEvent } from '../../../common/useEvent';
import { Button } from '../../../components/common/button/button';
import { Column, Row } from '../../../components/common/container/container';
import { FieldsetToggle } from '../../../components/common/fieldsetToggle';
import { Select } from '../../../components/common/select/select';
import { Tab, TabContainer } from '../../../components/common/tabs/tabs';
import { ModalDialog, useConfirmDialog } from '../../../components/dialog/dialog';
import {
	useCurrentAccount,
	useDirectoryChangeListener,
	useDirectoryConnector,
} from '../../../components/gameContext/directoryConnectorContextProvider';
import { CurrentSpaceInfo, IsSpaceAdmin, useSpaceInfo } from '../../../components/gameContext/gameStateContextProvider';
import bodyChange from '../../../icons/body-change.svg';
import devMode from '../../../icons/developer.svg';
import pronounChange from '../../../icons/male-female.svg';
import { DirectoryConnector } from '../../../networking/directoryConnector';
import { PersistentToast, TOAST_OPTIONS_ERROR } from '../../../persistentToast';
import './spaceConfiguration.scss';

const IsValidName = ZodMatcher(SpaceBaseInfoSchema.shape.name);
const IsValidDescription = ZodMatcher(SpaceBaseInfoSchema.shape.description);

function DefaultConfig(): SpaceDirectoryConfig {
	return {
		name: '',
		description: '',
		maxUsers: 10,
		admin: [],
		banned: [],
		allow: [],
		public: false,
		features: [],
	};
}

export const SPACE_FEATURES: { id: SpaceFeature; name: string; icon?: string; }[] = [
	{
		id: 'allowBodyChanges',
		name: 'Allow changes to character bodies',
		icon: bodyChange,
	},
	{
		id: 'allowPronounChanges',
		name: 'Allow changes to character pronouns',
		icon: pronounChange,
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

	const navigate = useNavigate();
	const currentAccount = useCurrentAccount();
	AssertNotNullable(currentAccount);
	const create = useCreateSpace();
	let currentSpaceInfo: Immutable<CurrentSpaceInfo> | null = useSpaceInfo();
	const lastSpaceId = useRef<SpaceId | null>();
	const isInPublicSpace = currentSpaceInfo.id != null;
	const isDeveloper = currentAccount?.roles !== undefined && IsAuthorized(currentAccount.roles, 'developer');
	if (creation) {
		currentSpaceInfo = null;
	} else {
		// Remember which space we were opened into - that way we can exit the screen if it changes abruptly
		if (lastSpaceId.current === undefined) {
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
				<input
					autoComplete='none'
					type='text'
					value={ currentConfig.name }
					onChange={ (event) => setModifiedData({ name: event.target.value }) }
					readOnly={ !canEdit }
				/>
				{ canEdit && !IsValidName(currentConfig.name) ? (<div className='error'>Invalid name</div>) : null }
			</div>
			<div className='input-container'>
				<label>Space size (maximum number of characters allowed inside - from 1 to { LIMIT_SPACE_MAX_CHARACTER_NUMBER })</label>
				<input autoComplete='none' type='number' value={ currentConfig.maxUsers } min={ 1 } max={ LIMIT_SPACE_MAX_CHARACTER_NUMBER } readOnly={ !canEdit }
					onChange={ (event) => setModifiedData({ maxUsers: Number.parseInt(event.target.value, 10) }) } />
			</div>
			<FieldsetToggle legend='Presentation and access'>
				<div className='input-container'>
					<label>Space description ({ currentConfig.description.length }/{ LIMIT_SPACE_DESCRIPTION_LENGTH } characters)</label>
					<textarea
						value={ currentConfig.description }
						onChange={ (event) => setModifiedData({ description: event.target.value }) }
						readOnly={ !canEdit }
						rows={ 16 }
					/>
					{ canEdit && !IsValidDescription(currentConfig.description) ? (<div className='error'>Invalid description</div>) : null }
				</div>
				<div className='input-container'>
					<label>Public</label>
					<Button onClick={ () => setModifiedData({ public: !currentConfig.public }) } disabled={ !canEdit } className='fadeDisabled'>{ currentConfig.public ? 'Yes' : 'No' }</Button>
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
								<input type='checkbox'
									id={ `${idPrefix}-feature-${feature.id}` }
									checked={ currentConfig.features.includes(feature.id) }
									onChange={ (event) => {
										if (event.target.checked) {
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
							<input type='checkbox' checked={ currentConfig.development?.autoAdmin ?? false } onChange={
								(event) => {
									const autoAdmin = event.target.checked;
									setModifiedData({
										development: {
											...currentConfig.development,
											autoAdmin,
										},
									});
								}
							} />
						</div>
						<div className='input-line'>
							<label>Bypass safemode cooldown</label>
							<input type='checkbox' checked={ currentConfig.development?.disableSafemodeCooldown ?? false } onChange={
								(event) => {
									const disableSafemodeCooldown = event.target.checked;
									setModifiedData({
										development: {
											...currentConfig.development,
											disableSafemodeCooldown,
										},
									});
								}
							} />
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

	const copyPublic = useCallback((ev: React.MouseEvent<HTMLElement>) => {
		ev.stopPropagation();
		CopyToClipboard(`https://project-pandora.com/space/join/${spaceId.split('/')[1]}`, () => toast('Copied invite to clipboard'));
	}, [spaceId]);

	useEffect(() => {
		update();
	}, [update]);

	const addInvite = useCallback((invite: SpaceInvite) => setInvites((inv) => [...inv, invite]), []);

	return (
		<FieldsetToggle legend='Invites'>
			<Column gap='medium'>
				<div onClick={ copyPublic } className='permanentInvite'>
					<span className='text'>Permanent public invite link:</span>
					<span className='invite'>https://project-pandora.com/space/join/{ spaceId.split('/')[1] }</span>
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
					<input type='checkbox' checked={ allowAccount } onChange={ (e) => setAllowAccount(e.target.checked) } />
					<input type='number' min={ 0 } value={ account } onChange={ (e) => setAccount(e.target.valueAsNumber) } readOnly={ !allowAccount } />
				</div>
				<div className='input-row'>
					<label>Limit To Character ID</label>
					<input type='checkbox' checked={ allowCharacter } onChange={ (e) => setAllowCharacter(e.target.checked) } />
					<input type='number' min={ 0 } value={ character } onChange={ (e) => setCharacter(e.target.valueAsNumber) } readOnly={ !allowCharacter } />
				</div>
				{
					isPlayerAdmin && (
						<div className='input-row'>
							<label>Max uses</label>
							<input type='checkbox' checked={ allowMaxUses } onChange={ (e) => setAllowMaxUses(e.target.checked) } />
							<input type='number' min={ 1 } value={ uses } onChange={ (e) => setUses(e.target.valueAsNumber) } readOnly={ !allowMaxUses } />
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
		CopyToClipboard(`https://project-pandora.com/space/join/${spaceId.split('/')[1]}?invite=${invite.id}`, () => toast('Copied invite id to clipboard'));
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

const SpaceConfigurationProgress = new PersistentToast();

function useCreateSpace(): (config: SpaceDirectoryConfig) => Promise<void> {
	const directoryConnector = useDirectoryConnector();
	const navigate = useNavigate();
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
