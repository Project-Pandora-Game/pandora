import React, { ForwardedRef, ReactElement, ReactNode, createContext, forwardRef, useCallback, useContext, useState } from 'react';
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
import { HoverElement } from '../hoverElement/hoverElement';

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

const ConfirmButton = forwardRef(function ConfirmButton({
	onClick,
	children,
	className,
	disabled,
}: {
	onClick: (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
	children: ReactNode;
	className?: string;
	disabled?: boolean;
}, ref: ForwardedRef<HTMLButtonElement>): ReactElement {
	const [confirmed, setConfirmed] = useState(false);
	const closeDialog = useContext(leaveButtonContext);

	const onClickInner = useCallback((e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
		if (confirmed) {
			onClick(e);
			closeDialog();
		} else {
			setConfirmed(true);
		}
	}, [onClick, closeDialog, confirmed]);

	const onCancel = useCallback(() => {
		setConfirmed(false);
	}, []);

	const text = confirmed ? 'Are you sure?' : children;

	return (
		<Row>
			{ confirmed ? <Button onClick={ onCancel }>Cancel</Button> : null }
			<Button onClick={ onClickInner } className={ className } disabled={ disabled } ref={ ref }>{ text }</Button>
		</Row>
	);
});

function ChatRoomLeave(): ReactElement | null {
	const player = usePlayer();
	const room = useChatRoomInfo();

	if (!player || !room) {
		return null;
	}

	return (
		<CharRoomLeaveInner player={ player } room={ room } />
	);
}

function CharRoomLeaveInner({ player, room }: { player: PlayerCharacter; room: IChatRoomFullInfo; }): ReactElement | null {
	const directoryConnector = useDirectoryConnector();
	const playerState = usePlayerState();
	const canLeave = useCharacterRestrictionsManager(playerState, player, (manager) => (manager.isInSafemode() || !manager.getEffects().blockRoomLeave));
	const [leaveButtonRef, setLeaveButtonRef] = useState<HTMLButtonElement | null>(null);

	const onRoomLeave = useCallback(() => {
		directoryConnector.awaitResponse('chatRoomLeave', EMPTY)
			.then((result) => {
				if (result.result !== 'ok') {
					toast(`Failed to leave room:\n${result.result}`, TOAST_OPTIONS_ERROR);
				}
			})
			.catch((err) => {
				GetLogger('LeaveRoom').warning('Error during room leave', err);
				toast(`Error during room creation:\n${err instanceof Error ? err.message : String(err)}`, TOAST_OPTIONS_ERROR);
			});
	}, [directoryConnector]);

	return (
		<fieldset>
			<legend>Chat Room</legend>
			<span>Name: { room.name }</span>
			<span>Id: { room.id }</span>
			{
				!canLeave ? (
					<HoverElement parent={ leaveButtonRef } className='action-warning'>
						An item is preventing you from leaving the room.
					</HoverElement>
				) : null
			}
			<ConfirmButton onClick={ onRoomLeave } className='fadeDisabled' disabled={ !canLeave } ref={ setLeaveButtonRef }>
				Leave room
			</ConfirmButton>
		</fieldset>
	);
}

function CharacterLeave(): ReactElement | null {
	const directoryConnector = useDirectoryConnector();
	const connectionInfo = useShardConnectionInfo();
	const characterData = usePlayerData();
	const characterName = (characterData && !characterData.inCreation) ? characterData.name : null;

	const onClick = useCallback((e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
		e.preventDefault();
		e.stopPropagation();
		directoryConnector.sendMessage('disconnectCharacter', EMPTY);
	}, [directoryConnector]);

	if (!connectionInfo) return null;

	return (
		<fieldset>
			<legend>Character</legend>
			<span>Name: { characterName ?? `[Character ${connectionInfo.characterId}]` }</span>
			<span>Id: { connectionInfo.characterId }</span>
			<ConfirmButton onClick={ onClick }>Change character</ConfirmButton>
		</fieldset>
	);
}

function AccountLeave(): ReactElement | null {
	const currentAccount = useCurrentAccount();
	const logout = useLogout();

	if (!currentAccount) return null;

	return (
		<fieldset>
			<legend>Account</legend>
			<span>Name: { currentAccount.username }</span>
			<span>Id: { currentAccount.id }</span>
			<ConfirmButton onClick={ logout }>Logout</ConfirmButton>
		</fieldset>
	);
}
