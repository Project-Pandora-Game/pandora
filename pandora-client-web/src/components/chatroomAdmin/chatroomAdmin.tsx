import { clamp, cloneDeep, noop } from 'lodash';
import {
	ChatRoomFeature,
	EMPTY,
	GetLogger,
	IChatRoomDirectoryConfig,
	IDirectoryAccountInfo,
	IDirectoryShardInfo,
	ChatRoomBaseInfoSchema,
	ZodMatcher,
	IsAuthorized,
	IChatroomBackgroundData,
	DEFAULT_BACKGROUND,
} from 'pandora-common';
import React, { ReactElement, useCallback, useMemo, useReducer, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { DirectoryConnector } from '../../networking/directoryConnector';
import { PersistentToast } from '../../persistentToast';
import { Button } from '../common/button/button';
import {
	useCurrentAccount,
	useDirectoryChangeListener,
	useDirectoryConnector,
} from '../gameContext/directoryConnectorContextProvider';
import './chatroomAdmin.scss';
import { useConnectToShard } from '../gameContext/shardConnectorContextProvider';
import { useChatRoomData } from '../gameContext/chatRoomContextProvider';
import { GetAssetManager } from '../../assets/assetManager';
import { Select } from '../common/select/select';
import bodyChange from './body-change.svg';
import devMode from './developer.svg';
import pronounChange from './male-female.svg';

const IsChatroomName = ZodMatcher(ChatRoomBaseInfoSchema.shape.name);

function DefaultRoomData(currentAccount: IDirectoryAccountInfo | null): IChatRoomDirectoryConfig {
	return {
		name: '',
		description: '',
		maxUsers: 10,
		admin: currentAccount ? [currentAccount.id] : [],
		banned: [],
		protected: false,
		password: null,
		features: [],
		background: cloneDeep(DEFAULT_BACKGROUND) as IChatroomBackgroundData,
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

export function ChatroomAdmin({ creation = false }: { creation?: boolean } = {}): ReactElement | null {
	const ID_PREFIX = 'chatroom-admin';

	const navigate = useNavigate();
	const currentAccount = useCurrentAccount();
	const createRoom = useCreateRoom();
	const roomData = useChatRoomData();
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
		if (result.protected === false) {
			result.password = null;
		}
		return result;
	}, {});
	const directoryConnector = useDirectoryConnector();
	const shards = useShards();
	const accountId = currentAccount?.id;

	const availableBackgrounds = useMemo(() => GetAssetManager().getBackgrounds(), []);

	const isPlayerAdmin = creation
	|| (accountId && roomData?.admin.includes(accountId))
	|| (roomData?.development?.autoAdmin && IsAuthorized(currentAccount?.roles ?? {}, 'developer'));

	const currentConfig: IChatRoomDirectoryConfig = {
		...(roomData ?? DefaultRoomData(currentAccount)),
		...roomModifiedData,
	};

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

	if (!creation && !roomData) {
		return <Navigate to='/chatroom_select' />;
	} else if (creation && roomData) {
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
				<label>Room description</label>
				<textarea value={ currentConfig.description } readOnly={ !isPlayerAdmin }
					onChange={ (event) => setRoomModifiedData({ description: event.target.value }) } />
			</div>
			<div className='input-container'>
				<label>Room size</label>
				<input autoComplete='none' type='number' value={ currentConfig.maxUsers } min={ 1 } readOnly={ !isPlayerAdmin }
					onChange={ (event) => setRoomModifiedData({ maxUsers: Number.parseInt(event.target.value, 10) }) } />
			</div>
			<div className='input-container'>
				<label>Admins</label>
				<NumberListArea values={ currentConfig.admin } setValues={ (admin) => setRoomModifiedData({ admin }) } readOnly={ !isPlayerAdmin } />
			</div>
			<div className='input-container'>
				<label>Ban list</label>
				<NumberListArea values={ currentConfig.banned } setValues={ (banned) => setRoomModifiedData({ banned }) } readOnly={ !isPlayerAdmin } />
			</div>
			<div className='input-container'>
				<label>Protected</label>
				<Button onClick={ () => setRoomModifiedData({ protected: !currentConfig.protected }) } disabled={ !isPlayerAdmin }>{ currentConfig.protected ? 'Yes' : 'No' }</Button>
			</div>
			{
				currentConfig.protected &&
				<div className='input-container'>
					<label>Password (optional)</label>
					<input autoComplete='none' type='text' value={ currentConfig.password ?? '' } readOnly={ !isPlayerAdmin }
						onChange={ (event) => setRoomModifiedData({ protected: true, password: event.target.value || null }) } />
				</div>
			}
			<div className='input-container'>
				<label>Background</label>
				<Select
					value={ typeof currentConfigBackground === 'string' ? currentConfigBackground : '' }
					disabled={ !isPlayerAdmin }
					onChange={ (event) => setRoomModifiedData({
						background: event.target.value ? event.target.value : (cloneDeep(DEFAULT_BACKGROUND) as IChatroomBackgroundData),
					}) }
				>
					{ availableBackgrounds.map((background) => (
						<option key={ background.id } value={ background.id }>{ background.name }</option>
					)) }
					<option value=''>[ Custom ]</option>
				</Select>
			</div>
			{
				typeof currentConfigBackground === 'string' ? null : (
					<>
						<div className='input-container'>
							<label>Background image</label>
							<div className='row-first'>
								<input type='text'
									value={ currentConfigBackground.image }
									readOnly={ !isPlayerAdmin }
									onChange={ (event) => setRoomModifiedData({ background: { ...currentConfigBackground, image: event.target.value } }) }
								/>
								<input type='color'
									value={ currentConfigBackground.image.startsWith('#') ? currentConfigBackground.image : '#FFFFFF' }
									readOnly={ !isPlayerAdmin }
									onChange={ (event) => setRoomModifiedData({ background: { ...currentConfigBackground, image: event.target.value } }) }
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
		</>
	);

	if (!roomData) {
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
			<p>Current room ID: <span className='selectable'>{ roomData.id }</span></p>
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
			{ isPlayerAdmin && <Button onClick={ () => UpdateRoom(directoryConnector, roomModifiedData, () => navigate('/chatroom')) }>Update room</Button> }
			{ !isPlayerAdmin && <Button onClick={ () => navigate('/chatroom') }>Back</Button> }
		</div>
	);
}

function NumberListArea({ values, setValues, readOnly }: { values: number[], setValues: (_: number[]) => void, readOnly: boolean }): ReactElement {
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
		<textarea value={ text } onChange={ onChange } readOnly={ readOnly } />
	);
}

const RoomAdminProgress = new PersistentToast();

function useCreateRoom(): (config: IChatRoomDirectoryConfig) => Promise<void> {
	const directoryConnector = useDirectoryConnector();
	const connectToShard = useConnectToShard();
	return useCallback(async (config) => {
		try {
			RoomAdminProgress.show('progress', 'Creating room...');
			const result = await directoryConnector.awaitResponse('chatRoomCreate', config);
			if (result.result === 'ok') {
				RoomAdminProgress.show('progress', 'Joining room...');
				await connectToShard(result);
				RoomAdminProgress.show('success', 'Room created!');
			} else {
				RoomAdminProgress.show('error', `Failed to create room:\n${result.result}`);
			}
		} catch (err) {
			GetLogger('CreateRoom').warning('Error during room creation', err);
			RoomAdminProgress.show('error', `Error during room creation:\n${err instanceof Error ? err.message : String(err)}`);
		}
	}, [directoryConnector, connectToShard]);
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
