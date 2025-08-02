import { Immutable } from 'immer';
import { EMPTY, GetLogger, SpaceClientInfo, SpaceId } from 'pandora-common';
import React, { ReactElement, createContext, useCallback, useContext, useState } from 'react';
import { toast } from 'react-toastify';
import logoutIcon from '../../assets/icons/logout.svg';
import onoffIcon from '../../assets/icons/on-off.svg';
import peopleIcon from '../../assets/icons/people-arrows.svg';
import { PlayerCharacter } from '../../character/player.ts';
import { useKeyDownEvent } from '../../common/useKeyDownEvent.ts';
import { useLogout } from '../../networking/account_manager.ts';
import { TOAST_OPTIONS_ERROR } from '../../persistentToast.ts';
import { useCurrentAccount } from '../../services/accountLogic/accountManagerHooks.ts';
import { useService } from '../../services/serviceProvider.tsx';
import { Button } from '../common/button/button.tsx';
import { Column, Row } from '../common/container/container.tsx';
import { ModalDialog } from '../dialog/dialog.tsx';
import { useDirectoryConnector } from '../gameContext/directoryConnectorContextProvider.tsx';
import { useCharacterRestrictionsManager, useGameState, useGlobalState, useSpaceInfoOptional } from '../gameContext/gameStateContextProvider.tsx';
import { usePlayer, usePlayerData } from '../gameContext/playerContextProvider.tsx';
import { useShardConnectionInfo } from '../gameContext/shardConnectorContextProvider.tsx';
import { HeaderButton } from './HeaderButton.tsx';
import './leaveButton.scss';

const leaveButtonContext = createContext((): boolean => false);

export function LeaveButton({ onClickExtra }: {
	onClickExtra?: () => void;
}) {
	const [show, setShow] = useState(false);
	const closeDialog = useCallback(() => {
		setShow(false);
		return true;
	}, []);

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

	useKeyDownEvent(closeDialog, 'Escape');

	return (
		<ModalDialog>
			<Column className='LeaveDialog' alignX='center' gap='large'>
				<SpaceLeave />
				{
					inPublicSpace ? (
						<span>
							<strong>
								Warning:
								Changing the character or logging out<br />
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
	const globalState = useGlobalState(useGameState());
	const roomDeviceLink = useCharacterRestrictionsManager(globalState, player, (manager) => manager.getRoomDeviceLink());
	const canLeave = useCharacterRestrictionsManager(globalState, player, (manager) => (manager.forceAllowRoomLeave() || !manager.getEffects().blockSpaceLeave));
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
			<span className='unimportant'>Id: { spaceId }</span>
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
			<Button onClick={ onLeave } disabled={ !canLeave || roomDeviceLink != null }>
				<img src={ logoutIcon } />Leave space
			</Button>
		</>
	);
}

function CharacterLeave(): ReactElement {
	const accountManager = useService('accountManager');
	const connectionInfo = useShardConnectionInfo();
	const characterData = usePlayerData();
	const characterName = (characterData && !characterData.inCreation) ? characterData.name : null;
	const closeDialog = useContext(leaveButtonContext);

	const onClick = useCallback((e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
		e.preventDefault();
		e.stopPropagation();
		accountManager.disconnectFromCharacter();
		closeDialog();
	}, [accountManager, closeDialog]);

	return (
		<fieldset>
			<legend>Character</legend>
			{
				connectionInfo ? (
					<>
						<span>Name: { characterName ?? `[Character ${connectionInfo.characterId}]` }</span>
						<span className='unimportant'>Id: { connectionInfo.characterId }</span>
						<Button onClick={ onClick }>
							<img src={ peopleIcon } />Change character
						</Button>
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
						<span className='unimportant'>Id: { currentAccount.id }</span>
						<Button onClick={ onClick }>
							<img src={ onoffIcon } />Logout
						</Button>
					</>
				) : (
					<span>Not logged in</span>
				)
			}
		</fieldset>
	);
}
