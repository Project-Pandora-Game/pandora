import classNames from 'classnames';
import { Immutable, produce } from 'immer';
import { AssertNever, AssertNotNullable, ICharacterRoomData, IDirectoryAccountInfo, SpaceClientInfo, type AppearanceAction, type AssetFrameworkCharacterState, type CharacterRoomPositionFollow } from 'pandora-common';
import { createContext, ReactElement, ReactNode, useCallback, useContext, useEffect, useId, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import arrowAllIcon from '../../../assets/icons/arrow_all.svg';
import bodyIcon from '../../../assets/icons/body.svg';
import forbiddenIcon from '../../../assets/icons/forbidden.svg';
import friendsIcon from '../../../assets/icons/friends.svg';
import letterIcon from '../../../assets/icons/letter.svg';
import lipsIcon from '../../../assets/icons/lips.svg';
import movementIcon from '../../../assets/icons/movement.svg';
import profileIcon from '../../../assets/icons/profile.svg';
import shieldIcon from '../../../assets/icons/shield.svg';
import shirtIcon from '../../../assets/icons/shirt.svg';
import { Character, useCharacterData, useCharacterDataOptional } from '../../../character/character.ts';
import { useAsyncEvent } from '../../../common/useEvent.ts';
import { Checkbox } from '../../../common/userInteraction/checkbox.tsx';
import { NumberInput } from '../../../common/userInteraction/input/numberInput.tsx';
import { AccountContactChangeHandleResult, useAccountContact } from '../../../components/accountContacts/accountContactContext.ts';
import { useGoToDM } from '../../../components/accountContacts/accountContacts.tsx';
import { Button } from '../../../components/common/button/button.tsx';
import { Column, Row } from '../../../components/common/container/container.tsx';
import { Scrollable } from '../../../components/common/scrollbar/scrollbar.tsx';
import { useContextMenuPosition } from '../../../components/contextMenu/index.ts';
import { DialogInPortal, useConfirmDialog } from '../../../components/dialog/dialog.tsx';
import { useDirectoryConnector } from '../../../components/gameContext/directoryConnectorContextProvider.tsx';
import { IsSpaceAdmin, useGameState, useGlobalState, useSpaceCharacters, useSpaceInfo } from '../../../components/gameContext/gameStateContextProvider.tsx';
import { usePlayerState } from '../../../components/gameContext/playerContextProvider.tsx';
import { useWardrobeExecuteChecked, WardrobeActionContextProvider } from '../../../components/wardrobe/wardrobeActionContext.tsx';
import { useStaggeredAppearanceActionResult } from '../../../components/wardrobe/wardrobeCheckQueue.ts';
import { GameLogicActionButton } from '../../../components/wardrobe/wardrobeComponents.tsx';
import { TOAST_OPTIONS_ERROR, TOAST_OPTIONS_WARNING } from '../../../persistentToast.ts';
import { useNavigatePandora } from '../../../routing/navigate.ts';
import { useCurrentAccount } from '../../../services/accountLogic/accountManagerHooks.ts';
import { useChatInput } from '../../../ui/components/chat/chatInput.tsx';
import { useRoomScreenContext } from '../../../ui/screens/room/roomContext.tsx';
import { useCanMoveCharacter, useCanPoseCharacter } from '../../../ui/screens/room/roomPermissionChecks.tsx';
import { PointLike } from '../../common/point.ts';

type MenuType = 'main' | 'admin' | 'contacts' | 'follow';

type CharacterMenuContext = {
	isPlayerAdmin: boolean;
	currentAccount: IDirectoryAccountInfo;
	character: Character<ICharacterRoomData>;
	characterState: AssetFrameworkCharacterState;
	spaceInfo: Immutable<SpaceClientInfo>;
	menu: MenuType;
	setMenu: (menu: MenuType) => void;
	close: () => void;
};

const characterMenuContext = createContext<CharacterMenuContext | null>(null);

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

	const characterState = useGlobalState(useGameState()).getCharacterState(character.id);
	const canMoveCharacter = useCanMoveCharacter(character);

	const spaceCharacters = useSpaceCharacters();
	const followTargetData = useCharacterDataOptional(characterState?.position.type === 'normal' && characterState.position.following != null ? (
		spaceCharacters.find((c) => c.id === characterState.position.following?.target) ?? null
	) : null);

	if (characterState?.position.type === 'normal' && characterState.position.following != null) {
		return (
			<span className='dim'>
				Following { followTargetData?.name ?? '[unknown]' } ({ characterState.position.following.target })
			</span>
		);
	}

	return (
		<button
			className={ classNames(
				'withIcon',
				(canMoveCharacter === 'forbidden') ? 'text-strikethrough' : null,
			) }
			onClick={ () => {
				if (canMoveCharacter === 'forbidden') {
					toast('You cannot move this character.', TOAST_OPTIONS_WARNING);
					return;
				}
				if (canMoveCharacter === 'prompt') {
					toast(`Attempting to move this character will ask them for permission.`, TOAST_OPTIONS_WARNING);
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

function FollowCharacterMenuItem(): ReactElement | null {
	const {
		character,
		close,
		setMenu,
	} = useCharacterMenuContext();

	const { globalState } = usePlayerState();
	const characterState = globalState.getCharacterState(character.id);
	const canMoveCharacter = useCanMoveCharacter(character);

	if (characterState?.position.type === 'normal' && characterState.position.following != null) {
		return <CharacterStopFollowButton characterState={ characterState } close={ close } />;
	}

	// Cannot lead/follow oneself
	if (character.isPlayer())
		return null;

	return (
		<button
			className={ classNames(
				'withIcon',
					(canMoveCharacter === 'forbidden') ? 'text-strikethrough' : null,
			) }
			onClick={ () => {
				setMenu('follow');
			} }
		>
			<img src={ movementIcon } />
			<span>Lead / Follow</span>
		</button>
	);
}

function CharacterFollowDialog(): ReactElement {
	const {
		character,
		characterState,
		close,
		setMenu,
	} = useCharacterMenuContext();

	const { playerState } = usePlayerState();

	const id = useId();
	const characterData = useCharacterData(character);
	const [playerFollows, setPlayerFollows] = useState(false);
	const [followData, setFollowData] = useState<Immutable<CharacterRoomPositionFollow>>(() => CalculateFollowDefault(playerFollows, 'relativeLock'));

	function CalculateFollowDefault(playerFollowsTarget: boolean, type: CharacterRoomPositionFollow['followType']): Immutable<CharacterRoomPositionFollow> {
		const follower = playerFollowsTarget ? playerState : characterState;
		const target = playerFollowsTarget ? characterState : playerState;

		if (type === 'relativeLock') {
			return {
				followType: 'relativeLock',
				target: target.id,
				delta: [
					follower.position.position[0] - target.position.position[0],
					follower.position.position[1] - target.position.position[1],
					follower.position.position[2] - target.position.position[2],
				],
			};
		} else if (type === 'leash') {
			const delta = [
				follower.position.position[0] - target.position.position[0],
				follower.position.position[1] - target.position.position[1],
				follower.position.position[2] - target.position.position[2],
			];
			const distance = Math.ceil(Math.hypot(...delta));
			return {
				followType: 'leash',
				target: target.id,
				distance,
			};
		}
		AssertNever(type);
	}

	const action = useMemo((): AppearanceAction => ({
		type: 'moveCharacter',
		target: {
			type: 'character',
			characterId: playerFollows ? playerState.id : characterState.id,
		},
		moveTo: {
			type: 'normal',
			position: (playerFollows ? playerState : characterState).position.position,
			following: followData,
		},
	}), [followData, playerFollows, characterState, playerState]);

	return (
		<Column>
			<Row alignY='center'>
				<Checkbox
					id={ id + ':playerLeads' }
					checked={ !playerFollows }
					onChange={ (checked) => {
						setPlayerFollows(!checked);
						setFollowData(CalculateFollowDefault(!checked, followData.followType));
					} }
					radioButtion
				/>
				<label htmlFor={ id + ':playerLeads' }>You lead { characterData.name } ({ characterData.id })</label>
			</Row>
			<Row alignY='center'>
				<Checkbox
					id={ id + ':playerFollows' }
					checked={ playerFollows }
					onChange={ (checked) => {
						setPlayerFollows(checked);
						setFollowData(CalculateFollowDefault(checked, followData.followType));
					} }
					radioButtion
				/>
				<label htmlFor={ id + ':playerFollows' }>You follow { characterData.name } ({ characterData.id })</label>
			</Row>
			<hr className='fill-x' />
			<div>Follow style:</div>
			<Row alignY='center'>
				<Checkbox
					id={ id + ':typeRelativeLock' }
					checked={ followData.followType === 'relativeLock' }
					onChange={ (checked) => {
						if (checked) {
							setFollowData(CalculateFollowDefault(playerFollows, 'relativeLock'));
						}
					} }
					radioButtion
				/>
				<label htmlFor={ id + ':typeRelativeLock' }>Keep relative position</label>
			</Row>
			<Row alignY='center'>
				<Checkbox
					id={ id + ':typeLeash' }
					checked={ followData.followType === 'leash' }
					onChange={ (checked) => {
						if (checked) {
							setFollowData(CalculateFollowDefault(playerFollows, 'leash'));
						}
					} }
					radioButtion
				/>
				<label htmlFor={ id + ':typeLeash' }>Keep distance (leash)</label>
			</Row>
			<hr className='fill-x' />
			{
				followData.followType === 'relativeLock' ? (
					<>
						<Row alignY='center'>
							<label className='flex-1'>&#x394;X:</label>
							<NumberInput
								className='flex-2'
								value={ followData.delta[0] }
								step={ 1 }
								onChange={ (v) => {
									setFollowData(produce(followData, (d) => {
										d.delta[0] = v;
									}));
								} }
							/>
						</Row>
						<Row alignY='center'>
							<label className='flex-1'>&#x394;Y:</label>
							<NumberInput
								className='flex-2'
								value={ followData.delta[1] }
								step={ 1 }
								onChange={ (v) => {
									setFollowData(produce(followData, (d) => {
										d.delta[1] = v;
									}));
								} }
							/>
						</Row>
						<Row alignY='center'>
							<label className='flex-1'>&#x394;Offset:</label>
							<NumberInput
								className='flex-2'
								value={ followData.delta[2] }
								step={ 1 }
								onChange={ (v) => {
									setFollowData(produce(followData, (d) => {
										d.delta[2] = v;
									}));
								} }
							/>
						</Row>
					</>
				) :
				followData.followType === 'leash' ? (
					<Row alignY='center'>
						<label className='flex-1'>Distance:</label>
						<NumberInput
							className='flex-2'
							value={ followData.distance }
							min={ 0 }
							step={ 1 }
							onChange={ (v) => {
								setFollowData(produce(followData, (d) => {
									d.distance = v;
								}));
							} }
						/>
					</Row>
				) :
				AssertNever(followData)
			}
			<hr className='fill-x' />
			<Row alignX='space-between'>
				<Button
					onClick={ () => {
						setMenu('main');
					} }
				>
					Cancel
				</Button>
				<GameLogicActionButton
					action={ action }
					onExecute={ () => {
						setMenu('main');
						close();
					} }
				>
					{ playerFollows ? 'Follow' : 'Lead' }
				</GameLogicActionButton>
			</Row>
		</Column>
	);
}

function CharacterStopFollowButton({ characterState, close }: {
	characterState: AssetFrameworkCharacterState;
	close: () => void;
}): ReactElement {
	const action = useMemo((): AppearanceAction => ({
		type: 'moveCharacter',
		target: { type: 'character', characterId: characterState.id },
		moveTo: produce(characterState.position, (d) => {
			delete d.following;
		}),
	}), [characterState]);
	const checkResult = useStaggeredAppearanceActionResult(action, { immediate: true });
	const available = checkResult != null && checkResult.valid;
	const { execute, processing } = useWardrobeExecuteChecked(action, checkResult, { onSuccess: close });

	return (
		<button
			onClick={ execute }
			disabled={ processing }
			className={ classNames(
				'withIcon',
				available ? null : 'text-strikethrough',
			) }
		>
			<img src={ movementIcon } />
			<span>Stop following</span>
		</button>
	);
}

export function CharacterContextMenuContent({ character, onClose }: {
	character: Character<ICharacterRoomData>;
	onClose: () => void;
}): ReactElement | null {
	const navigate = useNavigatePandora();
	const { setTarget } = useChatInput();
	const currentAccount = useCurrentAccount();
	const [menu, setMenu] = useState<MenuType>('main');

	const { globalState, player } = usePlayerState();
	const characterState = globalState.getCharacterState(character.id);

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

	const context = useMemo((): CharacterMenuContext | null => {
		if (!spaceInfo || !currentAccount || characterState == null) return null;
		return {
			isPlayerAdmin,
			currentAccount,
			character,
			characterState,
			spaceInfo,
			menu,
			setMenu,
			close: onCloseActual,
		};
	}, [isPlayerAdmin, currentAccount, character, characterState, spaceInfo, menu, setMenu, onCloseActual]);

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
						<PoseCharacterMenuItem />
						<MoveCharacterMenuItem />
						<FollowCharacterMenuItem />
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
				{ menu === 'follow' ? (
					<CharacterFollowDialog />
				) : null }
				<AdminActionContextMenu />
				<AccountContactActionContextMenu />
				{ menu !== 'follow' ? (
					<button onClick={ onCloseActual } >
						Close
					</button>
				) : null }
			</WardrobeActionContextProvider>
		</characterMenuContext.Provider>
	);
}
