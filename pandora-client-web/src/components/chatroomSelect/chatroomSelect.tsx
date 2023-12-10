import { noop } from 'lodash';
import { EMPTY, GetLogger, IChatRoomListInfo, IChatRoomExtendedInfoResponse, IClientDirectoryNormalResult, RoomId, AssertNotNullable } from 'pandora-common';
import React, { ReactElement, useCallback, useEffect, useReducer, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { PersistentToast } from '../../persistentToast';
import { Button } from '../common/button/button';
import { useChatRoomInfo } from '../gameContext/chatRoomContextProvider';
import { useCurrentAccount, useDirectoryChangeListener, useDirectoryConnector } from '../gameContext/directoryConnectorContextProvider';
import { ModalDialog } from '../dialog/dialog';
import { ResolveBackground } from 'pandora-common';
import { GetAssetsSourceUrl, useAssetManager } from '../../assets/assetManager';
import { ChatroomOwnershipRemoval, CHATROOM_FEATURES } from '../chatroomAdmin/chatroomAdmin';
import { Row } from '../common/container/container';
import './chatroomSelect.scss';
import closedDoor from '../../icons/closed-door.svg';
import privateDoor from '../../icons/private-door.svg';
import publicDoor from '../../icons/public-door.svg';
import { ContextHelpButton } from '../help/contextHelpButton';
import { Scrollbar } from '../common/scrollbar/scrollbar';
import { useObservable } from '../../observable';

const TIPS: readonly string[] = [
	`You can move your character inside a room by dragging the character name below her.`,
	`Careful! Your rooms are set to private as default when you first create them.`,
	`Press "arrow up" or right-click on a chat message to edit or delete it in the chat.`,
	`Your character can turn around for everyone in a chat room in the "Pose" tab or with "/turn".`,
	`Chat commands start with a "/" and typing just this one character shows a help menu.`,
	`You can use your browser's "back" and "forward" buttons to navigate between screens.`,
	`In the Pandora settings, character (chat) and account (direct messages) name colors are set separately.`,
	`Every single change in the wardrobe happens instantly and is immediately visible to everyone in the room.`,
	`You need to equip the handheld item "room construction tools" to decorate your rooms`,
	`Public rooms without an admin online inside are not publicly listed in the room search.`,
];

export function ChatroomSelect(): ReactElement {
	const roomInfo = useChatRoomInfo();
	const roomList = useRoomList();

	const directoryStatus = useObservable(useDirectoryConnector().directoryStatus);

	const [showTips, setShowTips] = useState(false);

	const [index, setIndex] = useReducer((oldState: number) => {
		return (oldState + 1) % TIPS.length;
	}, Math.floor(Math.random() * TIPS.length));

	useEffect(() => {
		const interval = setInterval(() => {
			setIndex();
		}, 8000);

		return () => {
			clearInterval(interval);
		};
	}, []);

	if (roomInfo) {
		return <Navigate to='/chatroom' />;
	}

	return (
		<div>
			<Row padding='medium' wrap alignX='space-between'>
				<Link to='/pandora_lobby'>◄ Back to lobby</Link><br />
				<span className='infoBox' onClick={ () => setShowTips(true) } >
					🛈 Tip: { TIPS[index] }
				</span>
			</Row>
			<Row wrap alignX='space-between'>
				<h2>Room search</h2>
				<Row padding='medium' alignY='center'>
					Accounts online: { directoryStatus.onlineAccounts } / Characters online: { directoryStatus.onlineCharacters }
				</Row>
			</Row>
			{ !roomList ? <div className='loading'>Loading...</div> : <ChatroomSelectRoomList roomList={ roomList } /> }
			{ showTips && <TipsListDialog
				hide={ () => setShowTips(false) }
			/> }
		</div>
	);
}

function TipsListDialog({ hide }: {
	hide: () => void;
}): ReactElement | null {

	return (
		<ModalDialog>
			<Scrollbar color='dark' className='policyDetails'>
				<h2>🛈 Full list of Pandora tips:</h2>
				<ul>
					{ TIPS.map((tip, index) => <li key={ index }>{ tip }</li>) }
				</ul>
			</Scrollbar>
			<Row padding='medium' alignX='center'>
				<Button onClick={ hide }>Close</Button>
			</Row>
		</ModalDialog>
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
							In Pandora, each room is persistent and has one or more owners.<br />
							It only gets deleted when it no longer has any owners.<br />
							A room is visible to everyone (except accounts banned from the room),<br />
							if it is marked as public and there is at least one admin inside the room.<br />
							The default setting for newly created rooms is private visibility.<br />
							You can always see rooms you are either admin or owner of.
						</p>
						<p>
							Each <strong>account</strong> has a maximum number of rooms it can own.<br />
							You can own at most { account.roomOwnershipLimit } rooms.<br />
							If you want to create another room beyond your room ownership limit,<br />
							you must select any of your owned rooms and either repurpose it or give up<br />
							ownership of that room (resulting in the room being deleted if it has no other owners).
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

	const { name, onlineCharacters, totalCharacters, maxUsers, description, hasPassword } = roomInfo;

	return (
		<>
			<a className='roomListGrid' onClick={ () => setShow(true) } >
				<div className='icon'>
					<img
						src={ hasPassword ? closedDoor : roomInfo.public ? publicDoor : privateDoor }
						title={ hasPassword ? 'Protected room' : roomInfo.public ? 'Public room' : 'Private room' }
						alt={ hasPassword ? 'Protected room' : roomInfo.public ? 'Public room' : 'Private room' } />
				</div>
				<div className='entry'>
					{ `${name} ( ${onlineCharacters} ` }
					<span className='offlineCount'>(+{ totalCharacters - onlineCharacters })</span>
					{ ` / ${maxUsers} )` }
				</div>
				<div className='description-preview'>{ `${description}` }</div>
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

	const assetManager = useAssetManager();
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
	const background = roomDetails?.background ? ResolveBackground(assetManager, roomDetails.background, GetAssetsSourceUrl()).image : '';
	const features = roomDetails?.features ?? [];

	const userIsOwner = !!roomDetails?.isOwner;
	const userIsAdmin = !!roomDetails?.isAdmin;

	return (
		<ModalDialog>
			<div className='chatroomDetails'>
				<div>
					Details for { roomDetails?.public ? 'public' : 'private' } room <b>{ name }</b><br />
				</div>
				<Row className='ownership' alignY='center'>
					Owned by: { owners.join(', ') }
				</Row>
				{ (background !== '' && !background.startsWith('#')) &&
					<img className='preview' src={ background } width='200px' height='100px' /> }
				<Row className='features'>
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
				<textarea className='widebox' value={ description } rows={ 16 } readOnly />
				{ characters.length > 0 &&
					<div className='title'>Current users in this room:
						<div className='users-list'>
							{
								characters.map((char) => (
									<div key={ char.id } className={ char.isOnline ? '' : 'offline' }>
										{ char.isOnline ? '' : '( ' }
										{ char.name } ({ char.id })
										{ char.isOnline ? '' : ' )' }
									</div>
								))
							}
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
				<Row padding='medium' className='buttons' alignX='space-between' alignY='center'>
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

	return useCallback(async (id, password) => {
		try {
			RoomJoinProgress.show('progress', 'Joining room...');
			const result = await directoryConnector.awaitResponse('chatRoomEnter', { id, password });
			if (result.result === 'ok') {
				RoomJoinProgress.show('success', 'Room joined!');
			} else {
				RoomJoinProgress.show('error', `Failed to join room:\n${ result.result }`);
			}
			return result.result;
		} catch (err) {
			GetLogger('JoinRoom').warning('Error during room join', err);
			RoomJoinProgress.show('error',
				`Error during room join:\n${ err instanceof Error ? err.message : String(err) }`);
			return 'failed';
		}
	}, [directoryConnector]);
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
