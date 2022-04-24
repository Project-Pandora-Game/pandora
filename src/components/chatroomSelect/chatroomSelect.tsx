import { EMPTY, IClientDirectoryNormalResult, IChatRoomDirectoryInfo, RoomId, GetLogger } from 'pandora-common';
import React, { ReactElement, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ChangeEventEmmiter, DirectoryConnector } from '../../networking/socketio_directory_connector';
import { ConnectToShard } from '../../networking/socketio_shard_connector';
import { Button } from '../common/Button/Button';
import { Room } from '../../character/room';
import { useObservable } from '../../observable';
import { PersistentToast } from '../../persistentToast';

export function ChatroomSelect(): ReactElement {
	const [info, setInfo] = useState<IClientDirectoryNormalResult['listRooms'] | undefined>(undefined);
	const navigate = useNavigate();
	const roomData = useObservable(Room.data);

	useEffect(() => {
		let mounted = true;
		async function awaitRooms() {
			const result = await DirectoryConnector.awaitResponse('listRooms', EMPTY);
			if (!mounted) {
				return;
			}
			setInfo(result);
		}
		awaitRooms().catch(() => { /** NOOP */ });
		const changeEventEmmiterCleanup = ChangeEventEmmiter.on('roomList', () => {
			awaitRooms().catch(() => { /** NOOP */ });
		});
		return () => {
			mounted = false;
			changeEventEmmiterCleanup();
		};
	}, [navigate]);

	if (roomData) {
		return <Navigate to='/chatroom' />;
	}

	return (
		<div>
			<Link to='/pandora_lobby'>◄ Back to lobby</Link><br />
			<Button onClick={ () => navigate('/chatroom_create') }>Create room</Button><br />
			Existing rooms:<br />
			<ul>
				{ info === undefined ? <div className='loading'>Loading...</div> : (
					info.rooms.map((room) => <RoomEntry key={ room.id } { ...room } />)
				) }
			</ul>
		</div>
	);
}

function RoomEntry({ id, name, description: _description, hasPassword: _hasPassword, maxUsers, users, protected: _roomIsProtected }: IChatRoomDirectoryInfo): ReactElement {
	return (
		<li>
			<a onClick={ () => void JoinRoom(id) }>{`${name} (${users}/${maxUsers})` }</a>
		</li>
	);
}

const RoomJoinProgress = new PersistentToast();

type ChatRoomEnterResult = IClientDirectoryNormalResult['chatRoomEnter']['result'];

function JoinRoom(id: RoomId): Promise<ChatRoomEnterResult> {
	return (async (): Promise<ChatRoomEnterResult> => {
		RoomJoinProgress.show('progress', 'Joining room...');
		const result = await DirectoryConnector.awaitResponse('chatRoomEnter', {
			id,
		});
		if (result.result === 'ok') {
			await ConnectToShard(result);
			RoomJoinProgress.show('success', 'Room joined!');
		} else {
			RoomJoinProgress.show('error', `Failed to join room:\n${result.result}`);
		}
		return result.result;
	})().catch<never>((err) => {
		GetLogger('CreateRoom').warning('Error during room creation', err);
		RoomJoinProgress.show('error', `Error during room creation:\n${err instanceof Error ? err.message : String(err)}`);
		throw err;
	});
}
