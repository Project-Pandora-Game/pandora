import { clamp, cloneDeep, noop } from 'lodash';
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
} from 'pandora-common';
import React, { ReactElement, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { DirectoryConnector } from '../../networking/directoryConnector';
import { PersistentToast } from '../../persistentToast';
import { Button } from '../common/button/button';
import {
	useCurrentAccount,
	useDirectoryChangeListener,
	useDirectoryConnector,
} from '../gameContext/directoryConnectorContextProvider';
import { IsChatroomAdmin, useChatRoomInfo } from '../gameContext/chatRoomContextProvider';
import { GetAssetsSourceUrl, useAssetManager } from '../../assets/assetManager';
import { Select } from '../common/select/select';
import { ModalDialog } from '../dialog/dialog';
import { Row } from '../common/container/container';
import bodyChange from '../../icons/body-change.svg';
import devMode from '../../icons/developer.svg';
import pronounChange from '../../icons/male-female.svg';
import { FieldsetToggle } from '../common/fieldsetToggle';
import './chatroomAdmin.scss';
import classNames from 'classnames';
import { ColorInput } from '../common/colorInput/colorInput';
import { SelectionIndicator } from '../common/selectionIndicator/selectionIndicator';

const IsChatroomName = ZodMatcher(ChatRoomBaseInfoSchema.shape.name);

function DefaultRoomData(): IChatRoomDirectoryConfig {
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
	const roomInfo = useChatRoomInfo();
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

	const isPlayerOwner = !!(creation || accountId && roomInfo?.owners.includes(accountId));
	const isPlayerAdmin = creation || IsChatroomAdmin(roomInfo, currentAccount);

	const currentConfig: IChatRoomDirectoryConfig = {
		...(roomInfo ?? DefaultRoomData()),
		...roomModifiedData,
	};

	const owners: readonly AccountId[] = creation ? [accountId] : (roomInfo?.owners ?? []);

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

	if (!creation && !roomInfo) {
		return <Navigate to='/chatroom_select' />;
	} else if (creation && roomInfo) {
		return <Navigate to='/chatroom' />;
	}

	if (shards && currentConfig.development?.shardId && !shards.some((s) => s.id === currentConfig.development?.shardId)) {
		delete currentConfig.development.shardId;
	}

	const configurableElements = (
		<>
			<div className='input-container'>
				<label>Room name</label>
				<input autoComplete='none' type='text' value={ currentConfig.name } readOnly={ !isPlayerAdmin }
					onChange={ (event) => setRoomModifiedData({ name: event.target.value }) } />
				{ !IsChatroomName(currentConfig.name) && <div className='error'>Invalid room name</div> }
			</div>
			<div className='input-container'>
				<label>Room size</label>
				<input autoComplete='none' type='number' value={ currentConfig.maxUsers } min={ 1 } readOnly={ !isPlayerAdmin }
					onChange={ (event) => setRoomModifiedData({ maxUsers: Number.parseInt(event.target.value, 10) }) } />
			</div>
			<FieldsetToggle legend='Presentation and access'>
				<div className='input-container'>
					<label>Room description</label>
					<textarea value={ currentConfig.description } readOnly={ !isPlayerAdmin }
						onChange={ (event) => setRoomModifiedData({ description: event.target.value }) } />
				</div>
				<div className='input-container'>
					<label>Public</label>
					<Button onClick={ () => setRoomModifiedData({ public: !currentConfig.public }) } disabled={ !isPlayerAdmin }>{ currentConfig.public ? 'Yes' : 'No' }</Button>
				</div>
				<div className='input-container'>
					<label>Entry password (optional)</label>
					<input autoComplete='none' type='text' value={ currentConfig.password ?? '' } readOnly={ !isPlayerAdmin }
						onChange={ (event) => setRoomModifiedData({ password: event.target.value || null }) } />
				</div>
			</FieldsetToggle>
			<FieldsetToggle legend='Permissions'>
				<div className='input-container'>
					<label>Owners</label>
					<Row>
						<NumberListArea className='flex-1' values={ owners } setValues={ () => { /* NOOP */ } } readOnly />
						{ !creation && roomInfo && isPlayerOwner ? <ChatroomOwnershipRemoval id={ roomInfo.id } name={ roomInfo.name } /> : null }
					</Row>
				</div>
				<div className='input-container'>
					<label>Admins</label>
					<NumberListArea values={ currentConfig.admin } setValues={ (admin) => setRoomModifiedData({ admin }) } readOnly={ !isPlayerAdmin } />
				</div>
				<div className='input-container'>
					<label>Ban list</label>
					<NumberListArea values={ currentConfig.banned } setValues={ (banned) => setRoomModifiedData({ banned }) } readOnly={ !isPlayerAdmin } />
				</div>
			</FieldsetToggle>
			<FieldsetToggle legend='Background'>
				<Button
					onClick={ () => setShowBackgrounds(true) }
					disabled={ !isPlayerAdmin }
				>
					Select a background
				</Button>
				{ showBackgrounds && <BackgroundSelectDialog
					hide={ () => setShowBackgrounds(false) }
					current={ currentConfigBackground }
					select={ (background) => setRoomModifiedData({ background }) }
				/> }
				{
					typeof currentConfigBackground === 'string' ? null : (
						<>
							<div className='input-container'>
								<label>Background color</label>
								<div className='row-first'>
									<ColorInput
										initialValue={ currentConfigBackground.image.startsWith('#') ? currentConfigBackground.image : '#FFFFFF' }
										onChange={ (color) => setRoomModifiedData({ background: { ...currentConfigBackground, image: color } }) }
										disabled={ !isPlayerAdmin }
									/>
								</div>
							</div>
							<div className='input-container'>
								<label>Room Size: width, height</label>
								<div className='row-half'>
									<input type='number'
										autoComplete='none'
										value={ currentConfigBackground.size[0] }
										readOnly={ !isPlayerAdmin }
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
										readOnly={ !isPlayerAdmin }
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
									readOnly={ !isPlayerAdmin }
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
										readOnly={ !isPlayerAdmin }
										{ ...scalingProps }
									/>
									<input type='number'
										value={ currentConfigBackground.scaling }
										readOnly={ !isPlayerAdmin }
										{ ...scalingProps }
									/>
								</div>
							</div>
						</>
					)
				}
			</FieldsetToggle>
		</>
	);

	if (!roomInfo) {
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
			<p>Current room ID: <span className='selectable-all'>{ roomInfo.id }</span></p>
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
			{ isPlayerAdmin && <Button className='fill-x' onClick={ () => UpdateRoom(directoryConnector, roomModifiedData, () => navigate('/chatroom')) }>Update room</Button> }
			{ !isPlayerAdmin && <Button className='fill-x' onClick={ () => navigate('/chatroom') }>Back</Button> }
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

function NumberListArea({ values, setValues, readOnly, ...props }: {
	values: readonly number[];
	setValues: (newValue: number[]) => void;
	readOnly: boolean;
	className?: string;
}): ReactElement {
	const [text, setText] = useState(values.join(', '));

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
		<textarea value={ text } onChange={ onChange } readOnly={ readOnly } { ...props } />
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

	const availableBackgrounds = useMemo(() => assetManager.getBackgrounds(), [assetManager]);
	const [nameFilter, setNameFilter] = useState('');
	const [tagFilter, setTagFilter] = useState('');

	const knownTags = useMemo(() => assetManager.backgroundTags, [assetManager]);

	const filteredBackgrounds = useMemo(() => {
		const tags = tagFilter.split(/\s+/);
		const filterParts = nameFilter.toLowerCase().trim().split(/\s+/);
		return availableBackgrounds.filter((background) => {
			// Filter background by making sure they have all requested tags
			const matchesAllTags = tags.length === 0 || tags.some((tag) => background.tags.includes(tag));
			const matchesName = filterParts.every((f) => background.name.toLowerCase().includes(f));
			return matchesName && matchesAllTags;
		});
	}, [availableBackgrounds, nameFilter, tagFilter]);

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
		<ModalDialog>
			<div className='backgroundSelect'>
				<div className='header'>
					<div>Select a background for the room</div>
					<input ref={ nameFilterInput }
						className='input-filter'
						placeholder='Background name…'
						value={ nameFilter }
						onChange={ (e) => setNameFilter(e.target.value) }
					/>
					<div className='dropdown'>
						<button className='dropdown-button'>Tag filter…</button>
						<div className='dropdown-content'>
							{ Array.from(knownTags)
								.map(([id, tag]) => (
									<a key={ id }
										onClick={ () => {
											setTagFilter(id);
										} }
									>
										{ `${tag.category}: ${tag.name}` }
									</a>
								)) }
						</div>
					</div>
				</div>
				<div className='backgrounds'>
					<a
						onClick={ () => {
							setSelectedBackground(DEFAULT_BACKGROUND);
						} }
					>
						<div
							className={ classNames('details', IsObject(selectedBackground) && 'selected', IsObject(current) && 'current') }
						>
							<div className='name'>[ Custom background ]</div>
						</div>
					</a>
					{ filteredBackgrounds
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
				</div>
				<Row className='footer' alignX='space-between'>
					<Button onClick={ hide }>Cancel</Button>
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

const RoomAdminProgress = new PersistentToast();

function useCreateRoom(): (config: IChatRoomDirectoryConfig) => Promise<void> {
	const directoryConnector = useDirectoryConnector();
	return useCallback(async (config) => {
		try {
			RoomAdminProgress.show('progress', 'Creating room...');
			const result = await directoryConnector.awaitResponse('chatRoomCreate', config);
			if (result.result === 'ok') {
				RoomAdminProgress.show('success', 'Room created!');
			} else {
				RoomAdminProgress.show('error', `Failed to create room:\n${result.result}`);
			}
		} catch (err) {
			GetLogger('CreateRoom').warning('Error during room creation', err);
			RoomAdminProgress.show('error', `Error during room creation:\n${err instanceof Error ? err.message : String(err)}`);
		}
	}, [directoryConnector]);
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
