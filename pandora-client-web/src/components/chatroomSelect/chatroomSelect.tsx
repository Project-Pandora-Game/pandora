import { noop } from 'lodash';
import { EMPTY, GetLogger, IChatRoomDirectoryInfo, IChatRoomExtendedInfoResponse, IClientDirectoryNormalResult, RoomId } from 'pandora-common';
import React, { ReactElement, useCallback, useState } from 'react';
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
import './chatroomSelect.scss';
import closedDoor from './closed-door.svg';
import openDoor from './opened-door.svg';
import bodyChange from './body-change.svg';
import devMode from './developer.svg';
import pronounChange from './male-female.svg';

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
						roomList.map((room) => <RoomEntry key={ room.id } { ...room } />) :
						<div>No room matches your filter criteria</div>
				)}
			</p>
		</div>
	);
}

function RoomEntry({ id, name, description: _description, hasPassword: _hasPassword, maxUsers, users, protected: _roomIsProtected }: IChatRoomDirectoryInfo): ReactElement {
	const joinRoom = useJoinRoom();

	const [show, setShow] = useState(false);
	const [roomPassword, setPassword] = useState('');
	const room = useRoomExtendedInfo(id);
	const accountId = useCurrentAccount()?.id;

	if (room?.result === 'success') {
		const roomDetails = room.data;
		const characters = roomDetails.characters;
		const admins = roomDetails.admin;
		const background = ResolveBackground(GetAssetManager(), roomDetails.background, GetAssetsSourceUrl());
		const userIsAdmin = admins.find((e) => e === accountId);

		return (
			<>
				<a className='room-list-grid' onClick={ () => setShow(true) } >
					<img className='room-list-entry' width='50px' src={ _roomIsProtected ? closedDoor : openDoor } title={ _roomIsProtected ? 'Protected room' : 'Open room' }></img>
					<div className='room-list-entry'>{`${name} (${users}/${maxUsers})`}</div>
					<div className='room-list-entry'></div>
					<div className='room-list-entry'>{(_description.length > 50) ? `${_description.substring(0, 47).concat('\u2026')}` : `${_description}`}</div>
				</a>
				{show && (
					<ModalDialog>
						<div className='chatroom-details'>
							<div>Details for room<br /> <b>{roomDetails.name}</b></div>
							{background.image[0] !== '#' && <img className='details-preview' src={ background.image } width='200px' height='100px' ></img>}
							<div className='details-features'>
								{_roomIsProtected && <img className='details-features-img' src={ closedDoor } title='Protected Room'></img>}
								{roomDetails.features.indexOf('allowBodyChanges') >= 0 && <img className='details-features-img' src={ bodyChange } title='Body changes allowed'></img>}
								{roomDetails.features.indexOf('development') >= 0 && <img className='details-features-img' src={ devMode } title='Developer mode'></img>}
								{roomDetails.features.indexOf('allowPronounChanges') >= 0 && <img className='details-features-img' src={ pronounChange } title='Pronoun Change allowed'></img>}
							</div>
							<div className='details-description-title'>Description:</div>
							<div className='details-description'>{roomDetails.description}</div>
							{userIsAdmin &&
								<div className='details-users'>Current users in this room:
									<div className='details-users-list'>
										{characters?.map((char) => <div key={ char.id }>{char.name}</div>)}
									</div>
								</div> }
							{(roomDetails.protected && roomDetails.hasPassword) &&
								<input
									type='password'
									value={ roomPassword }
									onChange={ (e) => setPassword(e.target.value) }
								/>}
							<div>{ roomPassword }</div>
							<div className='details-buttons'>
								<Button className='slim' onClick={ () => {
									joinRoom(id, roomPassword)
										.then((_joinResult) => {
											// You can handle the result of join attempt here (including failed ones)
											switch (_joinResult) {
												case 'ok':
													return;
												default: {
													setShow(true);
													return (_joinResult);
												}
											}
										})
										.catch((_error: unknown) => {
											// You can handle if joining crashed or server communication failed here
										});
								} }>
									Enter Room
								</Button>
								<Button className='slim' onClick={ () => setShow(false) }>Close</Button>
							</div>
						</div>
					</ModalDialog>
				)}
			</>
		);
	} else return (<br></br>);
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
