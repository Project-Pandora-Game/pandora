import classNames from 'classnames';
import { Immutable } from 'immer';
import { AssertNever, AssertNotNullable, ICharacterRoomData, IDirectoryAccountInfo, SpaceClientInfo } from 'pandora-common';
import { createContext, ReactElement, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'react-toastify';
import arrowAllIcon from '../../../assets/icons/arrow_all.svg';
import bodyIcon from '../../../assets/icons/body.svg';
import forbiddenIcon from '../../../assets/icons/forbidden.svg';
import friendsIcon from '../../../assets/icons/friends.svg';
import letterIcon from '../../../assets/icons/letter.svg';
import lipsIcon from '../../../assets/icons/lips.svg';
import profileIcon from '../../../assets/icons/profile.svg';
import shieldIcon from '../../../assets/icons/shield.svg';
import shirtIcon from '../../../assets/icons/shirt.svg';
import { Character, useCharacterData } from '../../../character/character.ts';
import { useAsyncEvent } from '../../../common/useEvent.ts';
import { AccountContactChangeHandleResult, useAccountContact } from '../../../components/accountContacts/accountContactContext.ts';
import { useGoToDM } from '../../../components/accountContacts/accountContacts.tsx';
import { Column } from '../../../components/common/container/container.tsx';
import { Scrollable } from '../../../components/common/scrollbar/scrollbar.tsx';
import { useContextMenuPosition } from '../../../components/contextMenu/index.ts';
import { DialogInPortal, useConfirmDialog } from '../../../components/dialog/dialog.tsx';
import { useDirectoryConnector } from '../../../components/gameContext/directoryConnectorContextProvider.tsx';
import { IsSpaceAdmin, useSpaceInfo } from '../../../components/gameContext/gameStateContextProvider.tsx';
import { usePlayer } from '../../../components/gameContext/playerContextProvider.tsx';
import { WardrobeActionContextProvider } from '../../../components/wardrobe/wardrobeActionContext.tsx';
import { PointLike } from '../../../graphics/graphicsCharacter.tsx';
import { TOAST_OPTIONS_ERROR, TOAST_OPTIONS_WARNING } from '../../../persistentToast.ts';
import { useCurrentAccount } from '../../../services/accountLogic/accountManagerHooks.ts';
import { useChatInput } from '../../../ui/components/chat/chatInput.tsx';
import { useRoomScreenContext } from '../../../ui/screens/room/roomContext.tsx';
import { useCanMoveCharacter, useCanPoseCharacter } from '../../../ui/screens/room/roomPermissionChecks.tsx';

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
				<button className='withIcon' onClick={ () => setMenu('admin') }>
					<img src={ shieldIcon } />
					<span>Admin</span>
				</button>
			);
		case 'admin':
			return <AdminActionContextMenuInner />;
		default:
			return null;
	}
}

function BlockMenu({ action }: { action: 'add' | 'remove'; }): ReactElement {
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

	if (action === 'add') {
		return (
			<button className='withIcon' onClick={ block } >
				<img src={ forbiddenIcon } />
				<span>Block</span>
			</button>
		);
	} else if (action === 'remove') {
		return (
			<button onClick={ block } >
				Unblock
			</button>
		);
	}

	AssertNever(action);
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
		<button className='withIcon' onClick={ onClick }>
			<img src={ letterIcon } />
			<span>Direct message</span>
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
					<BlockMenu action='add' />
				</>
			);
		case 'pending':
			return <FriendRequestMenu action='cancel' text='Cancel Request' />;
		case 'incoming':
			return (
				<>
					<FriendRequestMenu action='accept' text='Accept Request' />
					<FriendRequestMenu action='decline' text='Decline Request' />
					<BlockMenu action='add' />
				</>
			);
		case 'friend':
			return <UnfriendRequestMenu />;
		case 'blocked':
			return <BlockMenu action='remove' />;
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
				<button className='withIcon' onClick={ () => setMenu('contacts') }>
					<img src={ friendsIcon } />
					<span>Contacts</span>
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

export function CharacterContextMenu({ character, position, onClose }: {
	character: Character<ICharacterRoomData>;
	position: Readonly<PointLike>;
	onClose: () => void;
}): ReactElement | null {
	const ref = useContextMenuPosition(position);
	return (
		<DialogInPortal>
			<div className='context-menu' ref={ ref } onPointerDown={ (e) => e.stopPropagation() }>
				<Scrollable>
					<Column>
						<CharacterContextMenuContent character={ character } onClose={ onClose } />
					</Column>
				</Scrollable>
			</div>
		</DialogInPortal>
	);
}

function MoveCharacterMenuItem(): ReactElement | null {
	const {
		character,
		close,
	} = useCharacterMenuContext();
	const {
		setRoomSceneMode,
	} = useRoomScreenContext();

	const canMoveCharacter = useCanMoveCharacter(character);

	return (
		<button
			className={ classNames(
				'withIcon',
				canMoveCharacter ? null : 'text-strikethrough',
			) }
			onClick={ () => {
				if (!canMoveCharacter) {
					toast('You cannot move this character.', TOAST_OPTIONS_WARNING);
					return;
				}
				setRoomSceneMode({ mode: 'moveCharacter', characterId: character.id });
				close();
			} }
		>
			<img src={ arrowAllIcon } />
			<span>Move</span>
		</button>
	);
}

function PoseCharacterMenuItem(): ReactElement | null {
	const {
		character,
		close,
	} = useCharacterMenuContext();
	const {
		setRoomSceneMode,
	} = useRoomScreenContext();

	const canPoseCharacter = useCanPoseCharacter(character);

	return (
		<button
			className={ classNames(
				'withIcon',
				(canPoseCharacter === 'forbidden') ? 'text-strikethrough' : null,
			) }
			onClick={ () => {
				if (canPoseCharacter === 'forbidden') {
					toast('You cannot pose this character.', TOAST_OPTIONS_WARNING);
					return;
				}
				if (canPoseCharacter === 'prompt') {
					toast(`Attempting to change this character's pose will ask them for permission.`, TOAST_OPTIONS_WARNING);
				}
				setRoomSceneMode({ mode: 'poseCharacter', characterId: character.id });
				close();
			} }
		>
			<img src={ bodyIcon } />
			<span>Pose</span>
		</button>
	);
}

export function CharacterContextMenuContent({ character, onClose }: {
	character: Character<ICharacterRoomData>;
	onClose: () => void;
}): ReactElement | null {
	const navigate = useNavigate();
	const { setTarget } = useChatInput();
	const player = usePlayer();
	AssertNotNullable(player);
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
			<WardrobeActionContextProvider player={ player }>
				<span>
					{ characterData.name } ({ characterData.id })
				</span>
				<hr />
				{ menu === 'main' && (
					<>
						<button className='withIcon' onClick={ () => {
							onCloseActual();
							navigate(`/wardrobe/character/${characterData.id}`);
						} }>
							<img src={ shirtIcon } />
							<span>Wardrobe</span>
						</button>
						<button className='withIcon' onClick={ () => {
							onCloseActual();
							navigate(`/profiles/character/${characterData.id}`);
						} }>
							<img src={ profileIcon } />
							<span>Profile</span>
						</button>
						<MoveCharacterMenuItem />
						<PoseCharacterMenuItem />
						{ characterData.id !== player.id && (
							<button className='withIcon' onClick={ () => {
								onClose();
								setTarget(characterData.id);
							} }>
								<img src={ lipsIcon } />
								<span>Whisper</span>
							</button>
						) }
						<NavigateToDMMenu />
					</>
				) }
				<AdminActionContextMenu />
				<AccountContactActionContextMenu />
				<button onClick={ onCloseActual } >
					Close
				</button>
			</WardrobeActionContextProvider>
		</characterMenuContext.Provider>
	);
}
