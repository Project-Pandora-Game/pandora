import { noop } from 'lodash';
import { EMPTY, GetLogger, IChatRoomDirectoryInfo, IChatRoomExtendedInfoResponse, IClientDirectoryNormalResult, RoomId } from 'pandora-common';
import React, { ReactElement, useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useErrorHandler } from '../../common/useErrorHandler';
import { PersistentToast } from '../../persistentToast';
import { Button } from '../common/Button/Button';
import { useChatRoomData } from '../gameContext/chatRoomContextProvider';
import { useCurrentAccount, useDirectoryChangeListener, useDirectoryConnector } from '../gameContext/directoryConnectorContextProvider';
import { useConnectToShard } from '../gameContext/shardConnectorContextProvider';
import { ModalDialog } from '../dialog/dialog';
import { ResolveBackground } from 'pandora-common';
import { GetAssetManager, GetAssetsSourceUrl } from '../../assets/assetManager';
import { CHATROOM_FEATURES } from '../chatroomAdmin/chatroomAdmin';
import './chatroomSelect.scss';
import closedDoor from './closed-door.svg';
import openDoor from './opened-door.svg';
import { Row } from '../common/container/container';

export function ChatroomSelect(): ReactElement {
	const navigate = useNavigate();
	const roomData = useChatRoomData();
	const roomList = useRoomList();

	if (roomData) {
		return <Navigate to='/chatroom' />;
	}

	return (
		<div>
			<Link to='/pandora_lobby'>◄ Back to lobby</Link><br />
			<Button onClick={ () => navigate('/chatroom_create') }>Create room</Button><br />
			<p>
				Existing rooms: {roomList?.length }<br />
				{!roomList ? <div className='loading'>Loading...</div> : (
					roomList.length > 0 ?
						roomList.map((room) => <RoomEntry key={ room.id } roomInfo={ room } />) :
						<div>No room matches your filter criteria</div>
				)}
			</p>
		</div>
	);
}

function RoomEntry({ roomInfo }: {
	roomInfo: IChatRoomDirectoryInfo
}): ReactElement {

	const [show, setShow] = useState(false);

	const { name, users, maxUsers, description, protected: roomIsProtected } = roomInfo;

	return (
		<>
			<a className='room-list-grid' onClick={ () => setShow(true) } >
				<img className='room-list-entry' width='50px' src={ roomIsProtected ? closedDoor : openDoor } title={ roomIsProtected ? 'Protected room' : 'Open room' }></img>
				<div className='room-list-entry'>{`${name} (${users}/${maxUsers})`}</div>
				<div className='room-list-entry'></div>
				<div className='room-list-entry'>{(description.length > 50) ? `${description.substring(0, 47).concat('\u2026')}` : `${description}`}</div>
			</a>
			{ show && <RoomDetailsDialog
				baseRoomInfo={ roomInfo }
				hide={ () => setShow(false) }
			/> }
		</>
	);
}

function RoomDetailsDialog({ baseRoomInfo, hide }: {
	baseRoomInfo: IChatRoomDirectoryInfo
	hide: () => void;
}): ReactElement | null {
	const accountId = useCurrentAccount()?.id;
	const [roomPassword, setPassword] = useState('');
	const joinRoom = useJoinRoom();
	const room = useRoomExtendedInfo(baseRoomInfo.id);

	// Close if room disappears
	useEffect(() => {
		if (room?.result === 'notFound') {
			hide();
		}
	}, [room, hide]);

	// Do not show anything if the room doesn't exist anymore
	// Do not show anything if we don't have account (aka WTF?)
	if (room?.result === 'notFound' || accountId == null)
		return null;

	// Get basic info
	const { id, name, description, protected: roomIsProtected, hasPassword } = baseRoomInfo;
	// Get advanced info, if we can
	const roomDetails = room?.result === 'success' ? room.data : undefined;
	const characters = roomDetails?.characters ?? [];
	const admins = roomDetails?.admin ?? [];
	const background = roomDetails?.background ? ResolveBackground(GetAssetManager(), roomDetails.background, GetAssetsSourceUrl()).image : '';
	const features = roomDetails?.features ?? [];

	const userIsAdmin = admins.includes(accountId);

	return (
		<ModalDialog>
			<div className='chatroom-details'>
				<div>Details for room<br /> <b>{name}</b></div>
				{(background !== '' && !background.startsWith('#')) && <img className='details-preview' src={ background } width='200px' height='100px' ></img>}
				<div className='details-features'>
					{ roomIsProtected && <img className='details-features-img' src={ closedDoor } title='Protected Room' /> }
					{ CHATROOM_FEATURES.map((f) => <div key={ f.id }>{ features.includes(f.id) && <img className='details-features-img' src={ f.icon } title={ f.name } /> }</div>) }
				</div>
				<div className='details-description-title'>Description:</div>
				<textarea className='details-widebox' value={ description } rows={ 20 } readOnly />
				{characters.length > 0 &&
					<div className='details-title'>Current users in this room:
						<div className='details-users-list'>
							{characters.map((char) => <div key={ char.id }>{char.name} ({char.id})</div>)}
						</div>
					</div>}
				{(!userIsAdmin && roomIsProtected && hasPassword) &&
					<div className='details-title'>This room requires a password:</div>}
				{(!userIsAdmin && roomIsProtected && hasPassword) &&
					<input
						className='details-widebox'
						name='roomPwd'
						type='password'
						value={ roomPassword }
						onChange={ (e) => setPassword(e.target.value) }
					/>}
				<Row className='details-buttons' alignX='end'>
					<Button className='slim' onClick={ hide }>Close</Button>
					<Button className='slim' onClick={ () => {
						joinRoom(id, roomPassword)
							.then((joinResult) => {
								if (joinResult === 'notFound')
									hide();
								// For any other reason of failed join we more likely want to somehow show a message
							})
							.catch((_error: unknown) => {
								// You can handle if joining crashed or server communication failed here
							});
					} }>
						Enter Room
					</Button>
				</Row>
			</div>
		</ModalDialog>
	);
}

const RoomJoinProgress = new PersistentToast();

type ChatRoomEnterResult = IClientDirectoryNormalResult['chatRoomEnter']['result'];

function useJoinRoom(): (id: RoomId, password?: string) => Promise<ChatRoomEnterResult> {
	const directoryConnector = useDirectoryConnector();
	const connectToShard = useConnectToShard();
	const handleError = useErrorHandler();

	return useCallback(async (id, password) => {
		try {
			RoomJoinProgress.show('progress', 'Joining room...');
			const result = await directoryConnector.awaitResponse('chatRoomEnter', { id, password });
			if (result.result === 'ok') {
				await connectToShard(result);
				RoomJoinProgress.show('success', 'Room joined!');
			} else {
				RoomJoinProgress.show('error', `Failed to join room:\n${ result.result }`);
			}
			return result.result;
		} catch (err) {
			GetLogger('JoinRoom').warning('Error during room join', err);
			RoomJoinProgress.show('error',
				`Error during room join:\n${ err instanceof Error ? err.message : String(err) }`);
			handleError(err);
			throw err;
		}
	}, [directoryConnector, connectToShard, handleError]);
}

function useRoomList(): IChatRoomDirectoryInfo[] | undefined {
	const [roomList, setRoomList] = useState<IChatRoomDirectoryInfo[]>();
	const directoryConnector = useDirectoryConnector();

	const fetchRoomList = useCallback(async () => {
		const result = await directoryConnector.awaitResponse('listRooms', EMPTY);
		if (result && result.rooms) {
			setRoomList(result.rooms);
		}
	}, [directoryConnector]);

	useDirectoryChangeListener('roomList', () => {
		fetchRoomList().catch(noop);
	});

	return roomList;
}

export function useRoomExtendedInfo(chatroomId: RoomId): IChatRoomExtendedInfoResponse | undefined {
	const [response, setResponse] = useState<IChatRoomExtendedInfoResponse>();
	const directoryConnector = useDirectoryConnector();

	const fetchRoomInfo = useCallback(async () => {
		const result = await directoryConnector.awaitResponse('chatRoomGetInfo', { id: chatroomId });
		setResponse(result);
	}, [directoryConnector, chatroomId]);

	useDirectoryChangeListener('roomList', () => {
		fetchRoomInfo().catch(noop);
	});

	return response;
}
