import { Immutable } from 'immer';
import { AssertNotNullable, ICharacterRoomData, IDirectoryAccountInfo, SpaceClientInfo } from 'pandora-common';
import React, { createContext, ReactElement, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'react-toastify';
import { Character, useCharacterData } from '../../../character/character';
import { useAsyncEvent } from '../../../common/useEvent';
import { AccountContactChangeHandleResult, useAccountContact } from '../../../components/accountContacts/accountContactContext';
import { useGoToDM } from '../../../components/accountContacts/accountContacts';
import { Column } from '../../../components/common/container/container';
import { Scrollable } from '../../../components/common/scrollbar/scrollbar';
import { useContextMenuPosition } from '../../../components/contextMenu';
import { useConfirmDialog } from '../../../components/dialog/dialog';
import { useDirectoryConnector } from '../../../components/gameContext/directoryConnectorContextProvider';
import { IsSpaceAdmin, useSpaceInfo } from '../../../components/gameContext/gameStateContextProvider';
import { usePlayerId } from '../../../components/gameContext/playerContextProvider';
import { PointLike } from '../../../graphics/graphicsCharacter';
import { TOAST_OPTIONS_ERROR, TOAST_OPTIONS_WARNING } from '../../../persistentToast';
import { useCurrentAccount } from '../../../services/accountLogic/accountManagerHooks';
import { useChatInput } from '../../../ui/components/chat/chatInput';

type MenuType = 'main' | 'admin' | 'contacts';

const characterMenuContext = createContext<{
	isPlayerAdmin: boolean;
	currentAccount: IDirectoryAccountInfo;
	character: Character<ICharacterRoomData>;
	spaceInfo: Immutable<SpaceClientInfo>;
	menu: MenuType;
	setMenu: (menu: MenuType) => void;
	close: () => void;
} | null>(null);

function useCharacterMenuContext() {
	const context = useContext(characterMenuContext);
	AssertNotNullable(context);
	return context;
}

function AdminActionContextMenuInner(): ReactElement {
	const { character, spaceInfo, setMenu, close } = useCharacterMenuContext();
	const isCharacterAdmin = IsSpaceAdmin(spaceInfo, { id: character.data.accountId });
	const isAllowed = spaceInfo.allow.includes(character.data.accountId);
	const connector = useDirectoryConnector();

	const kick = useCallback(() => {
		if (isCharacterAdmin) {
			toast('Admins cannot be kicked', TOAST_OPTIONS_WARNING);
			return;
		}

		connector.sendMessage('spaceAdminAction', { action: 'kick', targets: [character.data.accountId] });
		close();
	}, [isCharacterAdmin, character, connector, close]);

	const ban = useCallback(() => {
		if (isCharacterAdmin) {
			toast('Admins cannot be banned', TOAST_OPTIONS_WARNING);
			return;
		}

		connector.sendMessage('spaceAdminAction', { action: 'ban', targets: [character.data.accountId] });
		close();
	}, [isCharacterAdmin, character, connector, close]);

	const allow = useCallback(() => {
		if (isCharacterAdmin) {
			toast('Admins cannot be allowed', TOAST_OPTIONS_WARNING);
			return;
		}

		connector.sendMessage('spaceAdminAction', { action: 'allow', targets: [character.data.accountId] });
		close();
	}, [isCharacterAdmin, character, connector, close]);

	const disallow = useCallback(() => {
		if (isCharacterAdmin) {
			toast('Admins cannot be disallowed', TOAST_OPTIONS_WARNING);
			return;
		}

		connector.sendMessage('spaceAdminAction', { action: 'disallow', targets: [character.data.accountId] });
		close();
	}, [isCharacterAdmin, character, connector, close]);

	const promote = useCallback(() => {
		connector.sendMessage('spaceAdminAction', { action: 'promote', targets: [character.data.accountId] });
		close();
	}, [character, connector, close]);

	const demote = useCallback(() => {
		connector.sendMessage('spaceAdminAction', { action: 'demote', targets: [character.data.accountId] });
		close();
	}, [character, connector, close]);

	return (
		<>
			<button onClick={ kick } className={ isCharacterAdmin ? 'text-strikethrough' : '' } >
				Kick
			</button>
			<button onClick={ ban } className={ isCharacterAdmin ? 'text-strikethrough' : '' } >
				Ban
			</button>
			{ isAllowed ? (
				<button onClick={ disallow } className={ isCharacterAdmin ? 'text-strikethrough' : '' }>
					Disallow
				</button>
			) : (
				<button onClick={ allow } className={ isCharacterAdmin ? 'text-strikethrough' : '' }>
					Allow
				</button>
			) }
			{ isCharacterAdmin ? (
				<button onClick={ demote } >
					Demote
				</button>
			) : (
				<button onClick={ promote } >
					Promote
				</button>
			) }
			<button onClick={ () => setMenu('main') } >
				Back
			</button>
		</>
	);
}

function AdminActionContextMenu(): ReactElement | null {
	const { isPlayerAdmin, currentAccount, character, menu, setMenu } = useCharacterMenuContext();

	if (!isPlayerAdmin) return null;
	if (character.data.accountId === currentAccount?.id) return null;

	switch (menu) {
		case 'main':
			return (
				<button onClick={ () => setMenu('admin') }>
					Admin
				</button>
			);
		case 'admin':
			return <AdminActionContextMenuInner />;
		default:
			return null;
	}
}

function BlockMenu({ action, text }: { action: 'add' | 'remove'; text: ReactNode; }): ReactElement {
	const directory = useDirectoryConnector();
	const { character } = useCharacterMenuContext();
	const confirm = useConfirmDialog();

	const block = useCallback(() => {
		confirm(`Confirm ${action === 'add' ? 'block' : 'unblock'}`, `Are you sure you want to ${action} the account behind ${character.data.name} ${action === 'add' ? 'to' : 'from'} your block list?`)
			.then((result) => {
				if (result) {
					directory.sendMessage('blockList', { action, id: character.data.accountId });
				}
			})
			.catch(() => { /** ignore */ });
	}, [action, character.data.accountId, character.data.name, confirm, directory]);

	return (
		<button onClick={ block } >
			{ text }
		</button>
	);
}

const errorHandler = (err: unknown) => toast(err instanceof Error ? err.message : 'An unknown error occurred', TOAST_OPTIONS_ERROR);

function FriendRequestMenu({ action, text }: { action: 'initiate' | 'accept' | 'decline' | 'cancel'; text: ReactNode; }): ReactElement {
	const directory = useDirectoryConnector();
	const { character } = useCharacterMenuContext();
	const confirm = useConfirmDialog();

	const [request] = useAsyncEvent(async () => {
		if (await confirm('Confirm change', `Are you sure you want to ${action} adding the account behind ${character.data.name} to your contacts list?`)) {
			return directory.awaitResponse('friendRequest', { action, id: character.data.accountId });
		}
		return undefined;
	}, AccountContactChangeHandleResult, { errorHandler });

	return (
		<button onClick={ request } >
			{ text }
		</button>
	);
}

function UnfriendRequestMenu(): ReactElement {
	const directory = useDirectoryConnector();
	const { character } = useCharacterMenuContext();
	const confirm = useConfirmDialog();

	const [request] = useAsyncEvent(async () => {
		if (await confirm(`Confirm removal`, `Are you sure you want to remove the account behind ${character.data.name} from your contacts list?`)) {
			return directory.awaitResponse('unfriend', { id: character.data.accountId });
		}
		return undefined;
	}, AccountContactChangeHandleResult, { errorHandler });

	return (
		<button onClick={ request } >
			Unfriend
		</button>
	);
}

function NavigateToDMMenu(): ReactElement | null {
	const { currentAccount, character } = useCharacterMenuContext();
	const onClick = useGoToDM(character.data.accountId);
	if (character.data.accountId === currentAccount?.id)
		return null;

	return (
		<button onClick={ onClick } >
			Go to Direct Messages
		</button>
	);
}

function AccountContactActionContextMenuInner(): ReactElement | null {
	const { character } = useCharacterMenuContext();
	const rel = useAccountContact(character.data.accountId);

	switch (rel?.type) {
		case undefined:
			return (
				<>
					<FriendRequestMenu action='initiate' text='Add to contacts' />
					<BlockMenu action='add' text='Block' />
				</>
			);
		case 'pending':
			return <FriendRequestMenu action='cancel' text='Cancel Request' />;
		case 'incoming':
			return (
				<>
					<FriendRequestMenu action='accept' text='Accept Request' />
					<FriendRequestMenu action='decline' text='Decline Request' />
					<BlockMenu action='add' text='Block' />
				</>
			);
		case 'friend':
			return <UnfriendRequestMenu />;
		case 'blocked':
			return <BlockMenu action='remove' text='Unblock' />;
		default:
			return null;
	}
}

function AccountContactActionContextMenu(): ReactElement | null {
	const { currentAccount, character, menu, setMenu } = useCharacterMenuContext();
	if (character.data.accountId === currentAccount?.id)
		return null;

	switch (menu) {
		case 'main':
			return (
				<button onClick={ () => setMenu('contacts') }>
					Contacts
				</button>
			);
		case 'contacts':
			return (
				<>
					<AccountContactActionContextMenuInner />
					<button onClick={ () => setMenu('main') } >
						Back
					</button>
				</>
			);
		default:
			return null;
	}
}

export function CharacterContextMenu({ character, position, onClose, closeText = 'Close' }: {
	character: Character<ICharacterRoomData>;
	position: Readonly<PointLike>;
	onClose: () => void;
	closeText?: string;
}): ReactElement | null {
	const ref = useContextMenuPosition(position);
	return (
		<div className='context-menu' ref={ ref } onPointerDown={ (e) => e.stopPropagation() }>
			<Scrollable color='lighter'>
				<Column>
					<CharacterContextMenuContent character={ character } onClose={ onClose } closeText={ closeText } />
				</Column>
			</Scrollable>
		</div>
	);
}

export function CharacterContextMenuContent({ character, onClose, closeText = 'Close' }: {
	character: Character<ICharacterRoomData>;
	onClose: () => void;
	closeText?: string;
}): ReactElement | null {
	const navigate = useNavigate();
	const { setTarget } = useChatInput();
	const playerId = usePlayerId();
	const currentAccount = useCurrentAccount();
	const [menu, setMenu] = useState<MenuType>('main');

	const characterData = useCharacterData(character);
	const spaceInfo = useSpaceInfo().config;
	const isPlayerAdmin = IsSpaceAdmin(spaceInfo, currentAccount);

	useEffect(() => {
		if (!isPlayerAdmin && menu === 'admin') {
			setMenu('main');
		}
	}, [isPlayerAdmin, menu]);

	const onCloseActual = useCallback(() => {
		setMenu('main');
		onClose();
	}, [onClose]);

	const context = useMemo(() => {
		if (!spaceInfo || !currentAccount) return null;
		return {
			isPlayerAdmin,
			currentAccount,
			character,
			spaceInfo,
			menu,
			setMenu,
			close: onCloseActual,
		};
	}, [isPlayerAdmin, currentAccount, character, spaceInfo, menu, setMenu, onCloseActual]);

	if (!spaceInfo || !context) {
		return null;
	}

	return (
		<characterMenuContext.Provider value={ context }>
			<span>
				{ characterData.name } ({ characterData.id })
			</span>
			{ menu === 'main' && (
				<>
					<button onClick={ () => {
						onCloseActual();
						navigate(`/wardrobe/character/${characterData.id}`);
					} }>
						Wardrobe
					</button>
					<button onClick={ () => {
						onCloseActual();
						navigate(`/profiles/character/${characterData.id}`);
					} }>
						Profile
					</button>
					{ characterData.id !== playerId && (
						<button onClick={ () => {
							onClose();
							setTarget(characterData.id);
						} }>
							Whisper
						</button>
					) }
					<NavigateToDMMenu />
				</>
			) }
			<AdminActionContextMenu />
			<AccountContactActionContextMenu />
			<button onClick={ onCloseActual } >
				{ closeText }
			</button>
		</characterMenuContext.Provider>
	);
}
