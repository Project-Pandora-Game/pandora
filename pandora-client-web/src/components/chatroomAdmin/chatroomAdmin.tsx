import { clamp, cloneDeep, noop, uniq } from 'lodash';
import {
	ChatRoomFeature,
	EMPTY,
	GetLogger,
	IChatRoomDirectoryConfig,
	IDirectoryShardInfo,
	ChatRoomBaseInfoSchema,
	ZodMatcher,
	DEFAULT_BACKGROUND,
	IsObject,
	AccountId,
	AssertNotNullable,
	RoomId,
	BackgroundTagDefinition,
	AssetManager,
	IChatroomBackgroundInfo,
	LIMIT_ROOM_DESCRIPTION_LENGTH,
	LIMIT_ROOM_NAME_LENGTH,
	CloneDeepMutable,
} from 'pandora-common';
import React, { ReactElement, ReactNode, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { DirectoryConnector } from '../../networking/directoryConnector';
import { PersistentToast } from '../../persistentToast';
import { Button } from '../common/button/button';
import {
	useCurrentAccount,
	useDirectoryChangeListener,
	useDirectoryConnector,
} from '../gameContext/directoryConnectorContextProvider';
import { ICurrentRoomInfo, IsChatroomAdmin, useChatRoomInfo } from '../gameContext/chatRoomContextProvider';
import { GetAssetsSourceUrl, useAssetManager } from '../../assets/assetManager';
import { Select } from '../common/select/select';
import { ModalDialog } from '../dialog/dialog';
import { Column, Row } from '../common/container/container';
import bodyChange from '../../icons/body-change.svg';
import devMode from '../../icons/developer.svg';
import pronounChange from '../../icons/male-female.svg';
import { FieldsetToggle } from '../common/fieldsetToggle';
import './chatroomAdmin.scss';
import { ColorInput } from '../common/colorInput/colorInput';
import { SelectionIndicator } from '../common/selectionIndicator/selectionIndicator';
import { Scrollbar } from '../common/scrollbar/scrollbar';
import { Immutable } from 'immer';

const IsChatroomName = ZodMatcher(ChatRoomBaseInfoSchema.shape.name);
const IsChatroomDescription = ZodMatcher(ChatRoomBaseInfoSchema.shape.description);

function DefaultRoomConfig(): IChatRoomDirectoryConfig {
	return {
		name: '',
		description: '',
		maxUsers: 10,
		admin: [],
		banned: [],
		public: false,
		password: null,
		features: [],
		background: cloneDeep(DEFAULT_BACKGROUND),
	};
}

export const CHATROOM_FEATURES: { id: ChatRoomFeature; name: string; icon?: string; }[] = [
	{
		id: 'allowBodyChanges',
		name: 'Allow changes to character body',
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

const MAX_SCALING = 4;

export function ChatroomCreate(): ReactElement {
	return <ChatroomAdmin creation={ true } />;
}

export function ChatroomAdmin({ creation = false }: { creation?: boolean; } = {}): ReactElement | null {
	const ID_PREFIX = 'chatroom-admin';

	const navigate = useNavigate();
	const currentAccount = useCurrentAccount();
	AssertNotNullable(currentAccount);
	const createRoom = useCreateRoom();
	let currentRoomInfo: Immutable<ICurrentRoomInfo> | null = useChatRoomInfo();
	const lastRoomId = useRef<RoomId | null>();
	const isInPublicRoom = currentRoomInfo.id != null;
	if (creation) {
		currentRoomInfo = null;
	} else {
		// Remember which room we were opened into - that way we can exit the screen if room changes abruptly
		if (lastRoomId.current === undefined) {
			lastRoomId.current = currentRoomInfo.id;
		}
	}
	const [roomModifiedData, setRoomModifiedData] = useReducer((oldState: Partial<IChatRoomDirectoryConfig>, action: Partial<IChatRoomDirectoryConfig>) => {
		const result: Partial<IChatRoomDirectoryConfig> = {
			...oldState,
			...action,
		};
		if (!creation) {
			delete result.features;
			delete result.development;
		} else if (result.features) {
			if (result.features.includes('development') && !result.development) {
				result.development = {};
			} else if (!result.features.includes('development')) {
				delete result.development;
			}
		}
		return result;
	}, {});
	const directoryConnector = useDirectoryConnector();
	const shards = useShards();
	const accountId = currentAccount.id;
	const [showBackgrounds, setShowBackgrounds] = useState(false);

	const currentConfig: IChatRoomDirectoryConfig = useMemo(() => ({
		...(CloneDeepMutable(currentRoomInfo?.config ?? DefaultRoomConfig())),
		...roomModifiedData,
	}), [currentRoomInfo, roomModifiedData]);
	const roomId: RoomId | null = currentRoomInfo?.id ?? null;

	const isPlayerOwner = !!(creation || accountId && currentRoomInfo?.config.owners.includes(accountId));
	const isPlayerAdmin = creation || currentRoomInfo == null || IsChatroomAdmin(currentRoomInfo.config, currentAccount);
	const canEdit = isPlayerAdmin && (creation || roomId != null);

	const owners: readonly AccountId[] = useMemo(() => (
		creation ? [accountId] : (currentRoomInfo?.config.owners ?? [])
	), [creation, accountId, currentRoomInfo]);

	const currentConfigBackground = currentConfig.background;

	const scalingProps = useMemo(() => ({
		min: 0,
		max: MAX_SCALING,
		step: 0.1,
		onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
			const scaling = clamp(Number.parseFloat(event.target.value), 0, MAX_SCALING);
			// Can't modify scaling of preset
			if (typeof currentConfigBackground === 'string')
				return;
			setRoomModifiedData({
				background: {
					...currentConfigBackground,
					scaling,
				},
			});
		},
	}), [setRoomModifiedData, currentConfigBackground]);

	const invalidBans = useMemo(() => ({
		note: 'Owners and admins will be removed from the ban list automatically.',
		when: [
			{ reason: 'Already an owner', list: owners },
			{ reason: 'Already an admin', list: currentConfig.admin },
		],
	}), [owners, currentConfig.admin]);

	if (!creation && currentRoomInfo != null && currentRoomInfo.id !== lastRoomId.current) {
		// If room id changes abruptly, navigate to default view (this is likely some form of kick or the room stopping to exist)
		return <Navigate to='/' />;
	} else if (creation && isInPublicRoom) {
		// If in a public room, you cannot make a new room directly (as you need to leave first)
		return <Navigate to='/chatroom' />;
	}

	if (shards && currentConfig.development?.shardId && !shards.some((s) => s.id === currentConfig.development?.shardId)) {
		delete currentConfig.development.shardId;
	}

	const configurableElements = (
		<>
			<div className='input-container'>
				<label>Room name ({ currentConfig.name.length }/{ LIMIT_ROOM_NAME_LENGTH } characters)</label>
				<input
					autoComplete='none'
					type='text'
					value={ currentConfig.name }
					onChange={ (event) => setRoomModifiedData({ name: event.target.value }) }
					readOnly={ !canEdit }
				/>
				{ canEdit && !IsChatroomName(currentConfig.name) ? (<div className='error'>Invalid room name</div>) : null }
			</div>
			<div className='input-container'>
				<label>Room size</label>
				<input autoComplete='none' type='number' value={ currentConfig.maxUsers } min={ 1 } readOnly={ !canEdit }
					onChange={ (event) => setRoomModifiedData({ maxUsers: Number.parseInt(event.target.value, 10) }) } />
			</div>
			<FieldsetToggle legend='Presentation and access'>
				<div className='input-container'>
					<label>Room description ({ currentConfig.description.length }/{ LIMIT_ROOM_DESCRIPTION_LENGTH } characters)</label>
					<textarea
						value={ currentConfig.description }
						onChange={ (event) => setRoomModifiedData({ description: event.target.value }) }
						readOnly={ !canEdit }
						rows={ 16 }
					/>
					{ canEdit && !IsChatroomDescription(currentConfig.description) ? (<div className='error'>Invalid description</div>) : null }
				</div>
				<div className='input-container'>
					<label>Public</label>
					<Button onClick={ () => setRoomModifiedData({ public: !currentConfig.public }) } disabled={ !canEdit } className='fadeDisabled'>{ currentConfig.public ? 'Yes' : 'No' }</Button>
				</div>
				<div className='input-container'>
					<label>Entry password (optional)</label>
					<input autoComplete='none' type='text' value={ currentConfig.password ?? '' } readOnly={ !canEdit }
						onChange={ (event) => setRoomModifiedData({ password: event.target.value || null }) } />
				</div>
			</FieldsetToggle>
			<FieldsetToggle legend='Permissions'>
				<div className='input-container'>
					<label>Owners</label>
					<Row>
						<NumberListArea className='flex-1' values={ owners } setValues={ () => { /* NOOP */ } } readOnly />
						{ !creation && currentRoomInfo != null && roomId != null && isPlayerOwner ? <ChatroomOwnershipRemoval id={ roomId } name={ currentRoomInfo.config.name } /> : null }
					</Row>
				</div>
				<div className='input-container'>
					<label>Admins</label>
					<NumberListArea values={ currentConfig.admin } setValues={ (admin) => setRoomModifiedData({ admin }) } readOnly={ !canEdit } />
				</div>
				<div className='input-container'>
					<label>Ban list</label>
					<NumberListArea values={ currentConfig.banned } setValues={ (banned) => setRoomModifiedData({ banned }) } readOnly={ !canEdit } invalid={ invalidBans } />
				</div>
			</FieldsetToggle>
			<FieldsetToggle legend='Background'>
				{ showBackgrounds && <BackgroundSelectDialog
					hide={ () => setShowBackgrounds(false) }
					current={ currentConfigBackground }
					select={ (background) => setRoomModifiedData({ background }) }
				/> }
				{
					typeof currentConfigBackground === 'string' ? (
						<Column>
							<BackgroundInfo background={ currentConfigBackground } />
							<Button
								onClick={ () => setShowBackgrounds(true) }
								disabled={ !canEdit }
								className='fadeDisabled'
							>
								Select a background
							</Button>
						</Column>
					) : (
						<>
							<div className='input-container'>
								<label>Background color</label>
								<div className='row-first'>
									<ColorInput
										initialValue={ currentConfigBackground.image.startsWith('#') ? currentConfigBackground.image : '#FFFFFF' }
										onChange={ (color) => setRoomModifiedData({ background: { ...currentConfigBackground, image: color } }) }
										disabled={ !canEdit }
									/>
								</div>
							</div>
							<div className='input-container'>
								<label>Room Size: width, height</label>
								<div className='row-half'>
									<input type='number'
										autoComplete='none'
										value={ currentConfigBackground.size[0] }
										readOnly={ !canEdit }
										onChange={ (event) => setRoomModifiedData({
											background: {
												...currentConfigBackground,
												size: [Number.parseInt(event.target.value, 10), currentConfigBackground.size[1]],
											},
										}) }
									/>
									<input type='number'
										autoComplete='none'
										value={ currentConfigBackground.size[1] }
										readOnly={ !canEdit }
										onChange={ (event) => setRoomModifiedData({
											background: {
												...currentConfigBackground,
												size: [currentConfigBackground.size[0], Number.parseInt(event.target.value, 10)],
											},
										}) }
									/>
								</div>
							</div>
							<div className='input-container'>
								<label>Y limit</label>
								<input type='number'
									autoComplete='none'
									min={ -1 }
									value={ currentConfigBackground.maxY ?? -1 }
									readOnly={ !canEdit }
									onChange={ (event) => {
										const value = Number.parseInt(event.target.value, 10);
										setRoomModifiedData({
											background: {
												...currentConfigBackground,
												maxY: isNaN(value) || value < 0 ? undefined : value,
											},
										});
									} }
								/>
							</div>
							<div className='input-container'>
								<label>Y Scaling</label>
								<div className='row-first'>
									<input type='range'
										value={ currentConfigBackground.scaling }
										readOnly={ !canEdit }
										{ ...scalingProps }
									/>
									<input type='number'
										value={ currentConfigBackground.scaling }
										readOnly={ !canEdit }
										{ ...scalingProps }
									/>
								</div>
							</div>
							<br />
							<Button
								onClick={ () => setShowBackgrounds(true) }
								disabled={ !canEdit }
								className='fadeDisabled'
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
			<div className='roomAdminScreen creation'>
				<Link to='/chatroom_select'>◄ Back</Link>
				<p>Room creation</p>
				{ configurableElements }
				<div className='input-container'>
					<label>Features (cannot be changed after creation)</label>
					<ul>
						{
							CHATROOM_FEATURES.map((feature) => (
								<li key={ feature.id }>
									<input type='checkbox'
										id={ `${ID_PREFIX}-feature-${feature.id}` }
										checked={ currentConfig.features.includes(feature.id) }
										onChange={ (event) => {
											if (event.target.checked) {
												if (!currentConfig.features.includes(feature.id)) {
													setRoomModifiedData({ features: [...currentConfig.features, feature.id] });
												}
											} else {
												setRoomModifiedData({ features: currentConfig.features.filter((f) => f !== feature.id) });
											}
										} }
									/>
									<label htmlFor={ `${ID_PREFIX}-feature-${feature.id}` }>{ feature.name }</label>
								</li>
							))
						}
					</ul>
				</div>
				{
					currentConfig.features.includes('development') &&
					<div className='input-container'>
						<h3>Development settings</h3>
						<label>Shard for room</label>
						<Select disabled={ !shards } value={ currentConfig.development?.shardId ?? '[Auto]' } onChange={
							(event) => {
								const value = event.target.value;
								setRoomModifiedData({
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
									setRoomModifiedData({
										development: {
											...currentConfig.development,
											autoAdmin,
										},
									});
								}
							} />
						</div>
					</div>
				}
				<Button onClick={ () => void createRoom(currentConfig) }>Create room</Button>
			</div>
		);
	}

	return (
		<div className='roomAdminScreen configuration'>
			<Link to='/chatroom'>◄ Back</Link>
			{
				roomId != null ? (
					<p>Current room ID: <span className='selectable-all'>{ roomId }</span></p>
				) : (
					<p>Currently in a personal room</p>
				)
			}
			{ configurableElements }
			<div className='input-container'>
				<label>Features (cannot be changed after creation)</label>
				<ul>
					{
						CHATROOM_FEATURES
							.filter((feature) => currentConfig.features.includes(feature.id))
							.map((feature) => (
								<li key={ feature.id }>{ feature.name }</li>
							))
					}
				</ul>
			</div>
			{ canEdit && <Button className='fill-x' onClick={ () => UpdateRoom(directoryConnector, roomModifiedData, () => navigate('/chatroom')) }>Update room</Button> }
			{ !canEdit && <Button className='fill-x' onClick={ () => navigate('/chatroom') }>Back</Button> }
		</div>
	);
}

export function ChatroomOwnershipRemoval({ buttonClassName, ...data }: { id: RoomId; name: string; buttonClassName?: string; }): ReactElement | null {
	const [state, setState] = useState<boolean>(false);
	return (
		<>
			<Button className={ buttonClassName } onClick={ () => setState(true) }>Give up room ownership</Button>
			{
				state ? (
					<ChatroomOwnershipRemovalDialog { ...data } closeDialog={ () => setState(false) } />
				) : (
					null
				)
			}
		</>
	);
}

function ChatroomOwnershipRemovalDialog({ id, name, closeDialog }: { id: RoomId; name: string; closeDialog: () => void; }): ReactElement {
	const directoryConnector = useDirectoryConnector();

	const removeOwnership = useCallback(() => {
		(async () => {
			RoomAdminProgress.show('progress', 'Removing ownership...');
			const result = await directoryConnector.awaitResponse('chatRoomOwnershipRemove', { id });
			if (result.result === 'ok') {
				RoomAdminProgress.show('success', 'Room ownership removed!');
				closeDialog();
			} else {
				RoomAdminProgress.show('error', `Failed to remove room ownership:\n${result.result}`);
			}
		})()
			.catch((err) => {
				GetLogger('UpdateRoom').warning('Error during room ownership removal', err);
				RoomAdminProgress.show('error', `Error during room ownership removal:\n${err instanceof Error ? err.message : String(err)}`);
			});
	}, [id, closeDialog, directoryConnector]);

	return (
		<ModalDialog priority={ 10 }>
			<p>
				<b>
					Are you sure that you no longer want ownership of this room?
				</b>
			</p>
			<p>
				Room name: { name }<br />
				Room id: { id }
			</p>
			<p>
				Removing yourself as an owner will turn you into an admin instead and free up a room slot in your account's room count limit.<br />
				Note that a room without any owner gets instantly deleted, kicking everyone currently inside the room in the process.<br />
				You cannot affect other owners - only an owner can give up their own ownership of a room.
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
	AssertNotNullable(backgroundInfo);

	return (
		<Column className='backgroundInfo'>
			<span className='name'>{ backgroundInfo.name }</span>
			<div className='preview'>
				<img src={ GetAssetsSourceUrl() + backgroundInfo.image } />
			</div>
		</Column>
	);
}

function BackgroundSelectDialog({ hide, current, select }: {
	hide: () => void;
	current: string | IChatRoomDirectoryConfig['background'];
	select: (background: IChatRoomDirectoryConfig['background']) => void;
}): ReactElement | null {
	const assetManager = useAssetManager();
	const [selectedBackground, setSelectedBackground] = useState(current);

	useEffect(() => {
		setSelectedBackground(current);
	}, [current]);

	const [nameFilter, setNameFilter] = useState('');
	const [selection, setSelection] = useState(() => BackgroundSelectionStateClass.create(assetManager));

	/** Comparator for sorting backgrounds */
	const backgroundSortOrder = useCallback((a: Readonly<IChatroomBackgroundInfo>, b: Readonly<IChatroomBackgroundInfo>): number => {
		return a.name.localeCompare(b.name);
	}, []);

	const backgroundsToShow = useMemo(() => {
		const filterParts = nameFilter.toLowerCase().trim().split(/\s+/);
		return selection.backgrounds
			.filter((b) => filterParts.every((f) => b.name.toLowerCase().includes(f)))
			.sort(backgroundSortOrder);
	}, [selection, nameFilter, backgroundSortOrder]);
	const nameFilterInput = useRef<HTMLInputElement>(null);

	useEffect(() => {
		// Handler to autofocus search
		const keyPressHandler = (ev: KeyboardEvent) => {
			if (
				nameFilterInput.current &&
				// Only if no other input is selected
				(!document.activeElement || !(document.activeElement instanceof HTMLInputElement)) &&
				// Only if this isn't a special key or key combo
				!ev.ctrlKey &&
				!ev.metaKey &&
				!ev.altKey &&
				ev.key.length === 1
			) {
				nameFilterInput.current.focus();
			}
		};
		window.addEventListener('keypress', keyPressHandler);
		return () => {
			window.removeEventListener('keypress', keyPressHandler);
		};
	}, []);

	return (
		<ModalDialog position='top'>
			<div className='backgroundSelect'>
				<div className='header'>
					<div className='header-filter'>
						<span>Select a background for the room</span>
						<input ref={ nameFilterInput }
							className='input-filter'
							placeholder='Background name…'
							value={ nameFilter }
							onChange={ (e) => setNameFilter(e.target.value) }
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
				<Scrollbar className='backgrounds' color='lighter'>
					{ backgroundsToShow
						.map((b) => (
							<a key={ b.id }
								onClick={ () => {
									setSelectedBackground(b.id);
								} }
							>
								<SelectionIndicator
									direction='column'
									align='center'
									justify='center'
									padding='small'
									selected={ b.id === selectedBackground }
									active={ b.id === current }
									className='details'
								>
									<div className='preview'>
										<img src={ GetAssetsSourceUrl() + b.preview } />
									</div>
									<div className='name'>{ b.name }</div>
								</SelectionIndicator>
							</a>
						)) }
				</Scrollbar>
				<Row className='footer' alignX='space-between'>
					<Button onClick={ hide }>Cancel</Button>
					<Button
						disabled={ IsObject(current) }
						className='hideDisabled'
						onClick={ () => {
							select(DEFAULT_BACKGROUND);
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

type BackgroundTag = Readonly<BackgroundTagDefinition & { id: string; }>;

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

const RoomAdminProgress = new PersistentToast();

function useCreateRoom(): (config: IChatRoomDirectoryConfig) => Promise<void> {
	const directoryConnector = useDirectoryConnector();
	const navigate = useNavigate();
	return useCallback(async (config) => {
		try {
			RoomAdminProgress.show('progress', 'Creating room...');
			const result = await directoryConnector.awaitResponse('chatRoomCreate', config);
			if (result.result === 'ok') {
				RoomAdminProgress.show('success', 'Room created!');
				navigate('/chatroom');
			} else {
				RoomAdminProgress.show('error', `Failed to create room:\n${result.result}`);
			}
		} catch (err) {
			GetLogger('CreateRoom').warning('Error during room creation', err);
			RoomAdminProgress.show('error', `Error during room creation:\n${err instanceof Error ? err.message : String(err)}`);
		}
	}, [directoryConnector, navigate]);
}

function UpdateRoom(directoryConnector: DirectoryConnector, config: Partial<IChatRoomDirectoryConfig>, onSuccess?: () => void): void {
	(async () => {
		RoomAdminProgress.show('progress', 'Updating room...');
		const result = await directoryConnector.awaitResponse('chatRoomUpdate', config);
		if (result.result === 'ok') {
			RoomAdminProgress.show('success', 'Room updated!');
			onSuccess?.();
		} else {
			RoomAdminProgress.show('error', `Failed to update room:\n${result.result}`);
		}
	})()
		.catch((err) => {
			GetLogger('UpdateRoom').warning('Error during room update', err);
			RoomAdminProgress.show('error', `Error during room update:\n${err instanceof Error ? err.message : String(err)}`);
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
	readonly availableBackgrounds: readonly Readonly<IChatroomBackgroundInfo>[];
	readonly availableTags: ReadonlyMap<string, readonly BackgroundTag[]>;
	readonly backgroundTags: ReadonlyMap<string, Readonly<BackgroundTagDefinition>>;
	readonly tagToCategory: ReadonlyMap<string, string>;
	readonly categories: readonly string[];
	readonly selectedCategories: Set<string>;
	readonly selectedTags: ReadonlyMap<string, Set<string>>;
}

class BackgroundSelectionStateClass {
	private readonly state: BackgroundSelectionState;
	public readonly backgrounds: readonly Readonly<IChatroomBackgroundInfo>[];
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

	private static isSelected(state: BackgroundSelectionState, info: Readonly<IChatroomBackgroundInfo>): boolean {
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
