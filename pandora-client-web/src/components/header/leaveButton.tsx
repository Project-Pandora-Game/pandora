import React, { ReactElement, createContext, useCallback, useContext, useState } from 'react';
import logoutIcon from '../../assets/icons/logout.svg';
import { HeaderButton } from './HeaderButton';
import { useShardConnectionInfo } from '../gameContext/shardConnectorContextProvider';
import { usePlayer, usePlayerData, usePlayerState } from '../gameContext/playerContextProvider';
import { useCurrentAccount, useDirectoryConnector } from '../gameContext/directoryConnectorContextProvider';
import { EMPTY, GetLogger, SpaceClientInfo, SpaceId } from 'pandora-common';
import { Button } from '../common/button/button';
import { useLogout } from '../../networking/account_manager';
import { useCharacterRestrictionsManager, useSpaceInfoOptional } from '../gameContext/gameStateContextProvider';
import { PlayerCharacter } from '../../character/player';
import { toast } from 'react-toastify';
import { TOAST_OPTIONS_ERROR } from '../../persistentToast';
import { ModalDialog } from '../dialog/dialog';
import { Column, Row } from '../common/container/container';
import './leaveButton.scss';
import { Immutable } from 'immer';

const leaveButtonContext = createContext(() => { /** noop */ });

export function LeaveButton({ onClickExtra }: {
	onClickExtra?: () => void;
}) {
	const [show, setShow] = useState(false);
	const closeDialog = useCallback(() => setShow(false), []);

	return (
		<leaveButtonContext.Provider value={ closeDialog }>
			<HeaderButton
				icon={ logoutIcon }
				iconAlt='Leave'
				title='Leave'
				onClick={ () => {
					setShow(true);
					onClickExtra?.();
				} }
			/>
			{
				show ? <DialogLeave /> : null
			}
		</leaveButtonContext.Provider>
	);
}

function DialogLeave(): ReactElement {
	const closeDialog = useContext(leaveButtonContext);
	const inPublicSpace = useSpaceInfoOptional()?.id != null;

	return (
		<ModalDialog>
			<Column className='LeaveDialog' alignX='center'>
				<SpaceLeave />
				{
					inPublicSpace ? (
						<span>
							<strong>
								Warning:
								Changing character or logging out<br />
								will leave the character inside the current space
							</strong>
						</span>
					) : null
				}
				<CharacterLeave />
				<AccountLeave />
				<Button onClick={ closeDialog }>Cancel</Button>
			</Column>
		</ModalDialog>
	);
}

function SpaceLeave(): ReactElement {
	const player = usePlayer();
	const space = useSpaceInfoOptional();

	return (
		<fieldset>
			<legend>Space</legend>
			{
				(player && space?.id) ? (
					<SpaceLeaveInner player={ player } config={ space.config } spaceId={ space.id } />
				) : player ? (
					<span>Currently in { player.name }'s personal space</span>
				) : (
					<span>No character selected</span>
				)
			}
		</fieldset>
	);
}

function SpaceLeaveInner({ player, config, spaceId }: {
	player: PlayerCharacter;
	config: Immutable<SpaceClientInfo>;
	spaceId: SpaceId;
}): ReactElement {
	const directoryConnector = useDirectoryConnector();
	const { playerState } = usePlayerState();
	const roomDeviceLink = useCharacterRestrictionsManager(playerState, player, (manager) => manager.getRoomDeviceLink());
	const canLeave = useCharacterRestrictionsManager(playerState, player, (manager) => (manager.forceAllowRoomLeave() || !manager.getEffects().blockRoomLeave));
	const closeDialog = useContext(leaveButtonContext);

	const onLeave = useCallback(() => {
		directoryConnector.awaitResponse('spaceLeave', EMPTY)
			.then((result) => {
				if (result.result !== 'ok') {
					toast(`Failed to leave space:\n${result.result}`, TOAST_OPTIONS_ERROR);
				} else {
					closeDialog();
				}
			})
			.catch((err) => {
				GetLogger('LeaveSpace').warning('Error while leaving space', err);
				toast(`Error while leaving space:\n${err instanceof Error ? err.message : String(err)}`, TOAST_OPTIONS_ERROR);
			});
	}, [directoryConnector, closeDialog]);

	return (
		<>
			<span>Name: { config.name }</span>
			<span>Id: { spaceId }</span>
			{
				roomDeviceLink ? (
					<Row alignX='center' padding='large'>
						<b>You must exit the room device before leaving the space.</b>
					</Row>
				) : null
			}
			{
				(!canLeave && roomDeviceLink == null) ? (
					<Row alignX='center' padding='large'>
						<b>An item is preventing you from leaving the space.</b>
					</Row>
				) : null
			}
			<Button onClick={ onLeave } className='fadeDisabled' disabled={ !canLeave || roomDeviceLink != null }>
				Leave space
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
		directoryConnector.disconnectFromCharacter();
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
					<span>No character selected</span>
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
						<span>Display name: { currentAccount.displayName }</span>
						<span>Username: { currentAccount.username }</span>
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
