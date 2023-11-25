import { AssertNotNullable, ICharacterRoomData, IChatRoomFullInfo, IDirectoryAccountInfo } from 'pandora-common';
import React, { ReactElement, useCallback, useState, useEffect, createContext, useContext, useMemo, ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Character, useCharacterData } from '../../../character/character';
import { PointLike } from '../../../graphics/graphicsCharacter';
import { useContextMenuPosition } from '../../contextMenu';
import { IsChatroomAdmin, useChatRoomInfo } from '../../gameContext/chatRoomContextProvider';
import { useDirectoryConnector, useCurrentAccount } from '../../gameContext/directoryConnectorContextProvider';
import { usePlayerId } from '../../gameContext/playerContextProvider';
import { useChatInput } from '../chatInput';
import { toast } from 'react-toastify';
import { TOAST_OPTIONS_ERROR } from '../../../persistentToast';
import { RelationshipChangeHandleResult, useRelationship } from '../../releationships/relationshipsContext';
import { useConfirmDialog } from '../../dialog/dialog';
import { useAsyncEvent } from '../../../common/useEvent';
import { useGoToDM } from '../../releationships/relationships';

type MenuType = 'main' | 'admin' | 'relationship';

const characterMenuContext = createContext<{
	isPlayerAdmin: boolean;
	currentAccount: IDirectoryAccountInfo;
	character: Character<ICharacterRoomData>;
	chatRoomInfo: IChatRoomFullInfo;
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
	const { character, chatRoomInfo, setMenu, close } = useCharacterMenuContext();
	const isCharacterAdmin = IsChatroomAdmin(chatRoomInfo, { id: character.data.accountId });
	const connector = useDirectoryConnector();

	const kick = useCallback(() => {
		connector.sendMessage('chatRoomAdminAction', { action: 'kick', targets: [character.data.accountId] });
		close();
	}, [character, connector, close]);

	const ban = useCallback(() => {
		connector.sendMessage('chatRoomAdminAction', { action: 'ban', targets: [character.data.accountId] });
		close();
	}, [character, connector, close]);

	const promote = useCallback(() => {
		connector.sendMessage('chatRoomAdminAction', { action: 'promote', targets: [character.data.accountId] });
		close();
	}, [character, connector, close]);

	const demote = useCallback(() => {
		connector.sendMessage('chatRoomAdminAction', { action: 'demote', targets: [character.data.accountId] });
		close();
	}, [character, connector, close]);

	return (
		<>
			<button onClick={ kick } >
				Kick
			</button>
			<button onClick={ ban } >
				Ban
			</button>
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
		confirm('Confirm Change', `Are you sure you want to ${action} the account behind ${character.data.name} ${ action === 'add' ? 'to' : 'from' } your block list?`)
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
		if (await confirm('Confirm Change', `Are you sure you want to ${action} adding the account behind ${character.data.name} to your contacts list?`)) {
			return directory.awaitResponse('friendRequest', { action, id: character.data.accountId });
		}
		return undefined;
	}, RelationshipChangeHandleResult, { errorHandler });

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
		if (await confirm('Confirm Change', `Are you sure you want to remove the account behind ${character.data.name} from your contacts list?`)) {
			return directory.awaitResponse('unfriend', { id: character.data.accountId });
		}
		return undefined;
	}, RelationshipChangeHandleResult, { errorHandler });

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

function RelationshipActionContextMenuInner(): ReactElement | null {
	const { character } = useCharacterMenuContext();
	const rel = useRelationship(character.data.accountId);

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

function RelationshipActionContextMenu(): ReactElement | null {
	const { currentAccount, character, menu, setMenu } = useCharacterMenuContext();
	if (character.data.accountId === currentAccount?.id)
		return null;

	switch (menu) {
		case 'main':
			return (
				<button onClick={ () => setMenu('relationship') }>
					Relationship
				</button>
			);
		case 'relationship':
			return (
				<>
					<RelationshipActionContextMenuInner />
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
	const navigate = useNavigate();
	const { setTarget } = useChatInput();
	const playerId = usePlayerId();
	const currentAccount = useCurrentAccount();
	const [menu, setMenu] = useState<MenuType>('main');

	const ref = useContextMenuPosition(position);

	const characterData = useCharacterData(character);
	const chatRoomInfo = useChatRoomInfo();
	const isPlayerAdmin = IsChatroomAdmin(chatRoomInfo, currentAccount);

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
		if (!chatRoomInfo || !currentAccount) return null;
		return {
			isPlayerAdmin,
			currentAccount,
			character,
			chatRoomInfo,
			menu,
			setMenu,
			close: onCloseActual,
		};
	}, [isPlayerAdmin, currentAccount, character, chatRoomInfo, menu, setMenu, onCloseActual]);

	if (!chatRoomInfo || !context) {
		return null;
	}

	return (
		<characterMenuContext.Provider value={ context }>
			<div className='context-menu' ref={ ref } onPointerDown={ (e) => e.stopPropagation() }>
				<span>
					{ characterData.name } ({ characterData.id })
				</span>
				{ menu === 'main' && (
					<>
						<button onClick={ () => {
							onCloseActual();
							navigate('/wardrobe', { state: { character: characterData.id } });
						} }>
							Wardrobe
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
				<RelationshipActionContextMenu />
				<button onClick={ onCloseActual } >
					{ closeText }
				</button>
			</div>
		</characterMenuContext.Provider>
	);
}
