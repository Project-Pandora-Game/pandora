import { noop } from 'lodash';
import { EMPTY, GetLogger, IChatRoomDirectoryInfo, IChatRoomExtendedInfoResponse, IClientDirectoryNormalResult, RoomId } from 'pandora-common';
import React, { ReactElement, useCallback, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useErrorHandler } from '../../common/useErrorHandler';
import { PersistentToast } from '../../persistentToast';
import { Button } from '../common/Button/Button';
import { useChatRoomData } from '../gameContext/chatRoomContextProvider';
import { useDirectoryChangeListener, useDirectoryConnector } from '../gameContext/directoryConnectorContextProvider';
import { useConnectToShard } from '../gameContext/shardConnectorContextProvider';
import { ModalDialog } from '../dialog/dialog';
import './chatroomSelect.scss';
import closedDoor from './closed-door.svg';
import openDoor from './opened-door.svg';

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
	const room = useRoomExtendedInfo(id);

	if (room?.result === 'success') {
		const roomDetails = room.data;
		const characters = roomDetails.characters;
		// const isAdmin = room.data.;

		return (
			<a className='room-list-grid' onClick={ () => void setShow(true) } >
				<img className='room-list-entry' width='50px' src={ _roomIsProtected ? closedDoor : openDoor } alt={ _roomIsProtected ? 'Protected room' : 'Open room' }></img>
				<div className='room-list-entry'>{`${name} (${users}/${maxUsers})`}</div>
				<div className='room-list-entry'>Some icons</div>
				<div className='room-list-entry'>{(_description.length > 50) ? `${_description.substring(0, 47).concat('\u2026')}` : `${_description}`}</div>
				{show && (
					<ModalDialog>
						<div className='chatroom-details'>
							<div>Details for room <b>{roomDetails.name}</b></div>
							<div>Description:</div>
							<div className='details-description'>{roomDetails.description}</div>
							<div>Current users in this room ({characters?.length}):
								<ul className='details-users'>
									{characters?.map((char) => <li key={ char.id }>{ char.name }</li>)}
								</ul>
							</div>
							{roomDetails.protected ? roomDetails.hasPassword ?
								<div>Enter the password:</div> : <div>You need to be an administrator</div> : <div></div>}
						</div>
						<Button className='slim' onClick={ () => void joinRoom }>Enter Room</Button>
						<Button className='slim' disabled={ true } onClick={ () => void close }>Close</Button>
					</ModalDialog>
				)}
			</a>
		);
	} else return (<br></br>);
}

const RoomJoinProgress = new PersistentToast();

type ChatRoomEnterResult = IClientDirectoryNormalResult['chatRoomEnter']['result'];

function useJoinRoom(): (id: RoomId) => Promise<ChatRoomEnterResult> {
	const directoryConnector = useDirectoryConnector();
	const connectToShard = useConnectToShard();
	const handleError = useErrorHandler();

	return useCallback(async (id) => {
		try {
			RoomJoinProgress.show('progress', 'Joining room...');
			const result = await directoryConnector.awaitResponse('chatRoomEnter', { id });
			if (result.result === 'ok') {
				await connectToShard(result);
				RoomJoinProgress.show('success', 'Room joined!');
			} else {
				RoomJoinProgress.show('error', `Failed to join room:\n${ result.result }`);
			}
			return result.result;
		} catch (err) {
			GetLogger('CreateRoom').warning('Error during room creation', err);
			RoomJoinProgress.show('error',
				`Error during room creation:\n${ err instanceof Error ? err.message : String(err) }`);
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
