import React, { ReactElement, useEffect, useReducer, useState } from 'react';
import { useObservable } from '../../observable';
import { Room } from '../../character/room';
import './chatroomAdmin.scss';
import { ChatRoomFeature, EMPTY, GetLogger, IChatRoomDirectoryConfig, IChatRoomFullInfo, IClientDirectoryNormalResult, IsChatroomName } from 'pandora-common';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Button } from '../common/Button/Button';
import { ChangeEventEmmiter, DirectoryConnector } from '../../networking/socketio_directory_connector';
import { ConnectToShard } from '../../networking/socketio_shard_connector';
import { PersistentToast } from '../../persistentToast';
import { currentAccount } from '../../networking/account_manager';

const DEFAULT_ROOM_DATA: () => IChatRoomDirectoryConfig = () => ({
	name: '',
	description: '',
	maxUsers: 10,
	admin: currentAccount.value ? [currentAccount.value.id] : [],
	banned: [],
	protected: false,
	password: null,
	features: [],
});

const CHATROOM_FEATURES: { id: ChatRoomFeature; name: string; }[] = [
	{
		id: 'development',
		name: 'Development mode',
	},
];

export function ChatroomCreate(): ReactElement {
	return <ChatroomAdmin creation={ true } />;
}

function ParseNumberListString(value: string): number[] {
	return value
		.split(',')
		.map((i) => Number.parseInt(i.trim(), 10))
		.filter((i) => Number.isInteger(i));
}

export function ChatroomAdmin({ creation = false }: { creation?: boolean } = {}): ReactElement | null {
	const navigate = useNavigate();
	const roomData: IChatRoomFullInfo | null = useObservable(Room.data);
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

	const [shardInfo, setShardInfo] = useState<IClientDirectoryNormalResult['shardInfo']['shards'] | undefined>(undefined);

	useEffect(() => {
		let mounted = true;
		async function listShards() {
			const result = await DirectoryConnector.awaitResponse('shardInfo', EMPTY);
			if (!mounted) {
				return;
			}
			setShardInfo(result.shards);
		}
		listShards().catch(() => { /** NOOP */ });
		const changeEventEmmiterCleanup = ChangeEventEmmiter.on('shardList', () => {
			listShards().catch(() => { /** NOOP */ });
		});
		return () => {
			mounted = false;
			changeEventEmmiterCleanup();
		};
	}, [setShardInfo]);

	if (!creation && !roomData) {
		return <Navigate to='/chatroom_select' />;
	} else if (creation && roomData) {
		return <Navigate to='/chatroom' />;
	}

	const currentConfig: IChatRoomDirectoryConfig = {
		...(roomData ?? DEFAULT_ROOM_DATA()),
		...roomModifiedData,
	};

	if (shardInfo && currentConfig.development?.shardId && !shardInfo.some((s) => s.id === currentConfig.development?.shardId)) {
		delete currentConfig.development.shardId;
	}

	const configurableElements = (
		<>
			<div className='input-container'>
				<label>Room name</label>
				<input autoComplete='none' type='text' value={ currentConfig.name }
					onChange={ (event) => setRoomModifiedData({ name: event.target.value }) } />
				{ !IsChatroomName(currentConfig.name) && <div className='error'>Invalid room name</div> }
			</div>
			<div className='input-container'>
				<label>Room description</label>
				<textarea value={ currentConfig.description }
					onChange={ (event) => setRoomModifiedData({ description: event.target.value }) } />
			</div>
			<div className='input-container'>
				<label>Limit</label>
				<input autoComplete='none' type='number' value={ currentConfig.maxUsers } min={ 1 }
					onChange={ (event) => setRoomModifiedData({ maxUsers: Number.parseInt(event.target.value, 10) }) } />
			</div>
			<div className='input-container'>
				<label>Admins</label>
				<textarea value={ currentConfig.admin.join(',') }
					onChange={ (event) => setRoomModifiedData({ admin: ParseNumberListString(event.target.value) }) } />
			</div>
			<div className='input-container'>
				<label>Banned</label>
				<textarea value={ currentConfig.banned.join(',') }
					onChange={ (event) => setRoomModifiedData({ banned: ParseNumberListString(event.target.value) }) } />
			</div>
			<div className='input-container'>
				<label>Protected</label>
				<Button onClick={ () => setRoomModifiedData({ protected: !currentConfig.protected }) } >{ currentConfig.protected ? 'Yes' : 'No' }</Button>
			</div>
			{
				currentConfig.protected &&
				<div className='input-container'>
					<label>Password (optional)</label>
					<input autoComplete='none' type='text' value={ currentConfig.password ?? '' }
						onChange={ (event) => setRoomModifiedData({ password: event.target.value || null }) } />
				</div>
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
								<li key={ feature.id }><input type='checkbox' checked={ currentConfig.features.includes(feature.id) } onChange={ (event) => {
									if (event.target.checked) {
										if (!currentConfig.features.includes(feature.id)) {
											setRoomModifiedData({ features: [...currentConfig.features, feature.id] });
										}
									} else {
										setRoomModifiedData({ features: currentConfig.features.filter((f) => f !== feature.id) });
									}
								} } />{ feature.name }
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
						<select disabled={ !shardInfo } value={ currentConfig.development?.shardId ?? '[Auto]' } onChange={
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
								!shardInfo ?
									<option>Loading...</option> :
									<>
										<option key='[Auto]' value='[Auto]' >[Auto]</option>
										{
											shardInfo.map((shard) => <option key={ shard.id } value={ shard.id }>{ shard.id } ({ shard.publicURL }) [v{ shard.version }]</option>)
										}
									</>
							}
						</select>
					</div>
				}
				<Button onClick={ () => CreateRoom(currentConfig) }>Create room</Button>
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
			<Button onClick={ () => UpdateRoom(currentConfig, () => navigate('/chatroom')) }>Update room</Button>
		</div>
	);
}

const RoomAdminProgress = new PersistentToast();

function CreateRoom(config: IChatRoomDirectoryConfig): void {
	(async () => {
		RoomAdminProgress.show('progress', 'Creating room...');
		const result = await DirectoryConnector.awaitResponse('chatRoomCreate', config);
		if (result.result === 'ok') {
			RoomAdminProgress.show('progress', 'Joining room...');
			await ConnectToShard(result);
			RoomAdminProgress.show('success', 'Room created!');
		} else {
			RoomAdminProgress.show('error', `Failed to create room:\n${result.result}`);
		}
	})()
		.catch((err) => {
			GetLogger('CreateRoom').warning('Error during room creation', err);
			RoomAdminProgress.show('error', `Error during room creation:\n${err instanceof Error ? err.message : String(err)}`);
		});
}

function UpdateRoom(config: Partial<IChatRoomDirectoryConfig>, onSuccess?: () => void): void {
	(async () => {
		RoomAdminProgress.show('progress', 'Updating room...');
		const result = await DirectoryConnector.awaitResponse('chatRoomUpdate', config);
		if (result.result === 'ok') {
			RoomAdminProgress.show('success', 'Room updated!');
			onSuccess?.();
		} else {
			RoomAdminProgress.show('error', `Failed to update room:\n${result.result}`);
		}
	})()
		.catch((err) => {
			GetLogger('CreateRoom').warning('Error during room update', err);
			RoomAdminProgress.show('error', `Error during room update:\n${err instanceof Error ? err.message : String(err)}`);
		});
}
