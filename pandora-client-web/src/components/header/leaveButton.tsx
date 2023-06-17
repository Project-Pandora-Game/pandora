import React, { ReactElement, createContext, useCallback, useContext, useState } from 'react';
import logoutIcon from '../../assets/icons/logout.svg';
import { HeaderButton } from './HeaderButton';
import { useShardConnectionInfo } from '../gameContext/shardConnectorContextProvider';
import { usePlayer, usePlayerData, usePlayerState } from '../gameContext/playerContextProvider';
import { useCurrentAccount, useDirectoryConnector } from '../gameContext/directoryConnectorContextProvider';
import { EMPTY, GetLogger, IChatRoomFullInfo } from 'pandora-common';
import { Button } from '../common/button/button';
import { useLogout } from '../../networking/account_manager';
import { useCharacterRestrictionsManager, useChatRoomInfo } from '../gameContext/chatRoomContextProvider';
import { PlayerCharacter } from '../../character/player';
import { toast } from 'react-toastify';
import { TOAST_OPTIONS_ERROR } from '../../persistentToast';
import { ModalDialog } from '../dialog/dialog';
import { Column, Row } from '../common/container/container';
import './leaveButton.scss';

const leaveButtonContext = createContext(() => { /** noop */ });

export function LeaveButton() {
	const [show, setShow] = useState(false);
	const closeDialog = useCallback(() => setShow(false), []);

	return (
		<leaveButtonContext.Provider value={ closeDialog }>
			<HeaderButton icon={ logoutIcon } iconAlt='Leave' onClick={ () => setShow(true) } title='Leave' />
			{
				show ? <DialogLeave /> : null
			}
		</leaveButtonContext.Provider>
	);
}

function DialogLeave(): ReactElement {
	const closeDialog = useContext(leaveButtonContext);

	return (
		<ModalDialog>
			<Column className='LeaveDialog'>
				<ChatRoomLeave />
				<CharacterLeave />
				<AccountLeave />
				<Button onClick={ closeDialog }>Cancel</Button>
			</Column>
		</ModalDialog>
	);
}

function ChatRoomLeave(): ReactElement {
	const player = usePlayer();
	const room = useChatRoomInfo();

	return (
		<fieldset>
			<legend>Chat Room</legend>
			{
				(player && room) ? (
					<CharRoomLeaveInner player={ player } room={ room } />
				) : (
					<span>Not in a chat room</span>
				)
			}
		</fieldset>
	);
}

function CharRoomLeaveInner({ player, room }: { player: PlayerCharacter; room: IChatRoomFullInfo; }): ReactElement {
	const directoryConnector = useDirectoryConnector();
	const playerState = usePlayerState();
	const canLeave = useCharacterRestrictionsManager(playerState, player, (manager) => (manager.isInSafemode() || !manager.getEffects().blockRoomLeave));
	const closeDialog = useContext(leaveButtonContext);

	const onRoomLeave = useCallback(() => {
		directoryConnector.awaitResponse('chatRoomLeave', EMPTY)
			.then((result) => {
				if (result.result !== 'ok') {
					toast(`Failed to leave room:\n${result.result}`, TOAST_OPTIONS_ERROR);
				} else {
					closeDialog();
				}
			})
			.catch((err) => {
				GetLogger('LeaveRoom').warning('Error while leaving room', err);
				toast(`Error while leaving room:\n${err instanceof Error ? err.message : String(err)}`, TOAST_OPTIONS_ERROR);
			});
	}, [directoryConnector, closeDialog]);

	return (
		<>
			<span>Name: { room.name }</span>
			<span>Id: { room.id }</span>
			{
				!canLeave ? (
					<Row alignX='center' padding='large'>
						<b>An item is preventing you from leaving the room.</b>
					</Row>
				) : null
			}
			<Button onClick={ onRoomLeave } className='fadeDisabled' disabled={ !canLeave }>
				Leave room
			</Button>
		</>
	);
}

function CharacterLeave(): ReactElement {
	const directoryConnector = useDirectoryConnector();
	const connectionInfo = useShardConnectionInfo();
	const characterData = usePlayerData();
	const characterName = (characterData && !characterData.inCreation) ? characterData.name : null;
	const closeDialog = useContext(leaveButtonContext);

	const onClick = useCallback((e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
		e.preventDefault();
		e.stopPropagation();
		directoryConnector.sendMessage('disconnectCharacter', EMPTY);
		closeDialog();
	}, [directoryConnector, closeDialog]);

	return (
		<fieldset>
			<legend>Character</legend>
			{
				connectionInfo ? (
					<>
						<span>Name: { characterName ?? `[Character ${connectionInfo.characterId}]` }</span>
						<span>Id: { connectionInfo.characterId }</span>
						<Button onClick={ onClick }>Change character</Button>
					</>
				) : (
					<span>Not connected</span>
				)
			}
		</fieldset>
	);
}

function AccountLeave(): ReactElement {
	const currentAccount = useCurrentAccount();
	const logout = useLogout();
	const closeDialog = useContext(leaveButtonContext);

	const onClick = useCallback((e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
		e.preventDefault();
		e.stopPropagation();
		logout();
		closeDialog();
	}, [logout, closeDialog]);

	return (
		<fieldset>
			<legend>Account</legend>
			{
				currentAccount ? (
					<>
						<span>Name: { currentAccount.username }</span>
						<span>Id: { currentAccount.id }</span>
						<Button onClick={ onClick }>Logout</Button>
					</>
				) : (
					<span>Not logged in</span>
				)
			}
		</fieldset>
	);
}
