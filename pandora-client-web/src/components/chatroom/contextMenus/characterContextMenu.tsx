import { AssertNotNullable, ICharacterRoomData, IChatRoomFullInfo, IDirectoryAccountInfo } from 'pandora-common';
import React, { ReactElement, useCallback, useState, useEffect, createContext, useContext, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { Character, useCharacterData } from '../../../character/character';
import { PointLike } from '../../../graphics/graphicsCharacter';
import { useContextMenuPosition } from '../../contextMenu';
import { IsChatroomAdmin, useChatRoomInfo } from '../../gameContext/chatRoomContextProvider';
import { useDirectoryConnector, useCurrentAccount } from '../../gameContext/directoryConnectorContextProvider';
import { usePlayerId } from '../../gameContext/playerContextProvider';
import { useChatInput } from '../chatInput';

type MenuType = 'main' | 'admin';

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
	if (character.data.accountId !== currentAccount?.id) return null;

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

export function CharacterContextMenu({ character, position, onClose }: {
	character: Character<ICharacterRoomData>;
	position: Readonly<PointLike>;
	onClose: () => void;
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

	if (!event || !chatRoomInfo || !context) {
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
					</>
				) }
				<AdminActionContextMenu />
				<button onClick={ onCloseActual } >
					Close
				</button>
			</div>
		</characterMenuContext.Provider>
	);
}
