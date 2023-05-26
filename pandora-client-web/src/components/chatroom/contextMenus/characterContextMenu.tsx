import { ICharacterRoomData, IChatRoomFullInfo } from 'pandora-common';
import React, { ReactElement, useCallback, useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Character, useCharacterData } from '../../../character/character';
import { PointLike } from '../../../graphics/graphicsCharacter';
import { useContextMenuPosition } from '../../contextMenu';
import { IsChatroomAdmin, useChatRoomInfo } from '../../gameContext/chatRoomContextProvider';
import { useDirectoryConnector, useCurrentAccount } from '../../gameContext/directoryConnectorContextProvider';
import { usePlayerId } from '../../gameContext/playerContextProvider';
import { useChatInput } from '../chatInput';

function AdminActionContextMenu({ character, chatRoomInfo, onClose, onBack }: { character: Character<ICharacterRoomData>; chatRoomInfo: IChatRoomFullInfo; onClose: () => void; onBack: () => void; }): ReactElement {
	const isCharacterAdmin = IsChatroomAdmin(chatRoomInfo, { id: character.data.accountId });
	const connector = useDirectoryConnector();

	const kick = useCallback(() => {
		connector.sendMessage('chatRoomAdminAction', { action: 'kick', targets: [character.data.accountId] });
		onClose();
	}, [character, connector, onClose]);

	const ban = useCallback(() => {
		connector.sendMessage('chatRoomAdminAction', { action: 'ban', targets: [character.data.accountId] });
		onClose();
	}, [character, connector, onClose]);

	const promote = useCallback(() => {
		connector.sendMessage('chatRoomAdminAction', { action: 'promote', targets: [character.data.accountId] });
		onClose();
	}, [character, connector, onClose]);

	const demote = useCallback(() => {
		connector.sendMessage('chatRoomAdminAction', { action: 'demote', targets: [character.data.accountId] });
		onClose();
	}, [character, connector, onClose]);

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
			<button onClick={ onBack } >
				Back
			</button>
		</>
	);
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
	const [menu, setMenu] = useState<'main' | 'admin'>('main');

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

	if (!event || !chatRoomInfo) {
		return null;
	}

	return (
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
			{ (isPlayerAdmin && character.data.accountId !== currentAccount?.id) && (
				<>
					{ menu === 'main' ? (
						<button onClick={ () => setMenu('admin') }>
							Admin
						</button>
					) : (
						<AdminActionContextMenu character={ character } chatRoomInfo={ chatRoomInfo } onClose={ onCloseActual } onBack={ () => setMenu('main') } />
					) }
				</>
			) }
			<button onClick={ () => {
				onCloseActual();
			} } >
				Close
			</button>
		</div>
	);
}
