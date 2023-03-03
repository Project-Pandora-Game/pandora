import { noop } from 'lodash';
import { EMPTY, GetLogger, IChatRoomListInfo, IChatRoomExtendedInfoResponse, IClientDirectoryNormalResult, RoomId, AssertNotNullable } from 'pandora-common';
import React, { ReactElement, useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useErrorHandler } from '../../common/useErrorHandler';
import { PersistentToast } from '../../persistentToast';
import { Button } from '../common/button/button';
import { useChatRoomData } from '../gameContext/chatRoomContextProvider';
import { useCurrentAccount, useDirectoryChangeListener, useDirectoryConnector } from '../gameContext/directoryConnectorContextProvider';
import { useConnectToShard } from '../gameContext/shardConnectorContextProvider';
import { ModalDialog } from '../dialog/dialog';
import { ResolveBackground } from 'pandora-common';
import { GetAssetManager, GetAssetsSourceUrl } from '../../assets/assetManager';
import { ChatroomOwnershipRemoval, CHATROOM_FEATURES } from '../chatroomAdmin/chatroomAdmin';
import { Row } from '../common/container/container';
import './chatroomSelect.scss';
import closedDoor from '../../icons/closed-door.svg';
import openDoor from '../../icons/opened-door.svg';
import { ContextHelpButton } from '../help/contextHelpButton';

export function ChatroomSelect(): ReactElement {
	const roomData = useChatRoomData();
	const roomList = useRoomList();

	if (roomData) {
		return <Navigate to='/chatroom' />;
	}

	return (
		<div>
			<Link to='/pandora_lobby'>◄ Back to lobby</Link><br />
			<h2>Room search</h2>
			{ !roomList ? <div className='loading'>Loading...</div> : <ChatroomSelectRoomList roomList={ roomList } /> }
		</div>
	);
}

function ChatroomSelectRoomList({ roomList }: {
	roomList: IChatRoomListInfo[];
}): ReactElement {
	const navigate = useNavigate();
	const account = useCurrentAccount();
	AssertNotNullable(account);

	const ownRooms = roomList.filter((r) => r.isOwner);
	const otherRooms = roomList.filter((r) => !r.isOwner);

	return (
		<>
			<div>
				<h3>
					My rooms ({ ownRooms.length }/{ account.roomOwnershipLimit })
					<ContextHelpButton>
						<p>
							Rooms are a place where you can meet other characters.
						</p>
						<p>
							In Pandora each room has one or more owners. A room that looses all owners is deleted.<br />
							Each <strong>account</strong> however has a limit on how many rooms it can own.
							You can own at most { account.roomOwnershipLimit } rooms.<br />
							You will always see all the rooms you are an owner of in the room search.
						</p>
						<p>
							If you want to make another room past the limit of your rooms,<br />
							you will have to select any of the rooms you own and give up ownership of that room<br />
							(possibly deleting the room in the process, if it has no other owner).
						</p>
					</ContextHelpButton>
				</h3>
				{ ownRooms.map((room) => <RoomEntry key={ room.id } roomInfo={ room } />) }
				{
					ownRooms.length >= account.roomOwnershipLimit ? null : (
						<a className='roomListGrid' onClick={ () => navigate('/chatroom_create') } >
							<div className='icon'>➕</div>
							<div className='entry'>Create a new room</div>
						</a>
					)
				}
			</div>
			<hr />
			<div>
				<h3>Found rooms ({ otherRooms.length })</h3>
				{ otherRooms.length === 0 ? <p>No room matches your filter criteria</p> : null }
				{ otherRooms.map((room) => <RoomEntry key={ room.id } roomInfo={ room } />) }
			</div>
		</>
	);
}

function RoomEntry({ roomInfo }: {
	roomInfo: IChatRoomListInfo;
}): ReactElement {

	const [show, setShow] = useState(false);

	const { name, users, maxUsers, description, hasPassword } = roomInfo;

	return (
		<>
			<a className='roomListGrid' onClick={ () => setShow(true) } >
				<div className='icon'>
					<img
						src={ hasPassword ? closedDoor : openDoor }
						title={ hasPassword ? 'Protected room' : 'Open room' }
						alt={ hasPassword ? 'Protected room' : 'Open room' } />
				</div>
				<div className='entry'>{ `${name} (${users}/${maxUsers})` }</div>
				<div className='entry'>{ (description.length > 50) ? `${description.substring(0, 49).concat('\u2026')}` : `${description}` }</div>
			</a>
			{ show && <RoomDetailsDialog
				baseRoomInfo={ roomInfo }
				hide={ () => setShow(false) }
			/> }
		</>
	);
}

function RoomDetailsDialog({ baseRoomInfo, hide }: {
	baseRoomInfo: IChatRoomListInfo;
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
	const { id, name, description, hasPassword } = baseRoomInfo;
	// Get advanced info, if we can
	const roomDetails = room?.result === 'success' ? room.data : undefined;
	const characters = roomDetails?.characters ?? [];
	const owners = roomDetails?.owners ?? [];
	const background = roomDetails?.background ? ResolveBackground(GetAssetManager(), roomDetails.background, GetAssetsSourceUrl()).image : '';
	const features = roomDetails?.features ?? [];

	const userIsOwner = !!roomDetails?.isOwner;
	const userIsAdmin = !!roomDetails?.isAdmin;

	return (
		<ModalDialog>
			<div className='chatroomDetails'>
				<div>
					Details for room <b>{ name }</b><br />
				</div>
				<Row padding='none' className='ownership' alignY='center'>
					Owned by: { owners.join(', ') }
				</Row>
				{ (background !== '' && !background.startsWith('#')) &&
					<img className='preview' src={ background } width='200px' height='100px' /> }
				<Row padding='none' className='features'>
					{ hasPassword && <img className='features-img' src={ closedDoor } title='Protected Room' /> }
					{
						CHATROOM_FEATURES
							.filter((f) => features.includes(f.id))
							.map((f) => (
								<img key={ f.id } className='features-img' src={ f.icon } title={ f.name } alt={ f.name } />
							))
					}
				</Row>
				<div className='description-title'>Description:</div>
				<textarea className='widebox' value={ description } rows={ 10 } readOnly />
				{ characters.length > 0 &&
					<div className='title'>Current users in this room:
						<div className='users-list'>
							{ characters.map((char) => <div key={ char.id }>{ char.name } ({ char.id })</div>) }
						</div>
					</div> }
				{ (!userIsAdmin && hasPassword) &&
					<div className='title'>This room requires a password:</div> }
				{ (!userIsAdmin && hasPassword) &&
					<input className='widebox'
						name='roomPwd'
						type='password'
						value={ roomPassword }
						onChange={ (e) => setPassword(e.target.value) }
					/> }
				<Row className='buttons' alignX='space-between' alignY='center'>
					<Button onClick={ hide }>Close</Button>
					{ userIsOwner && <ChatroomOwnershipRemoval buttonClassName='slim' id={ id } name={ name } /> }
					<Button className='fadeDisabled'
						disabled={ !userIsAdmin && hasPassword && !roomPassword }
						onClick={ () => {
							joinRoom(id, roomPassword)
								.then((joinResult) => {
									if (joinResult === 'notFound')
										hide();
									// TODO: Move error messages here from the join itself (or remove this handler)
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

function useRoomList(): IChatRoomListInfo[] | undefined {
	const [roomList, setRoomList] = useState<IChatRoomListInfo[]>();
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
