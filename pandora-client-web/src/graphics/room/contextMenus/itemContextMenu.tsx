import classNames from 'classnames';
import { AppearanceAction, EvalItemPath, ItemId, type ActionTargetSelector, type AssetFrameworkRoomState, type Item, type ItemContainerPath, type RoomId } from 'pandora-common';
import { ReactElement, useCallback, useContext, useEffect, useId, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import arrowAllIcon from '../../../assets/icons/arrow_all.svg';
import forbiddenIcon from '../../../assets/icons/forbidden.svg';
import movementIcon from '../../../assets/icons/movement.svg';
import shirtIcon from '../../../assets/icons/shirt.svg';
import storageIcon from '../../../assets/icons/storage.svg';
import { Checkbox } from '../../../common/userInteraction/checkbox.tsx';
import { Button } from '../../../components/common/button/button.tsx';
import { Column, Row } from '../../../components/common/container/container.tsx';
import { useContextMenuPosition } from '../../../components/contextMenu/index.ts';
import { DialogInPortal, DraggableDialogPriorityContext } from '../../../components/dialog/dialog.tsx';
import { usePlayer } from '../../../components/gameContext/playerContextProvider.tsx';
import { ResolveItemDisplayName } from '../../../components/wardrobe/itemDetail/wardrobeItemName.tsx';
import { useWardrobeExecuteChecked, WardrobeActionContextProvider } from '../../../components/wardrobe/wardrobeActionContext.tsx';
import { ActionProblemsContent } from '../../../components/wardrobe/wardrobeActionProblems.tsx';
import { useStaggeredAppearanceActionResult } from '../../../components/wardrobe/wardrobeCheckQueue.ts';
import { GameLogicActionButton } from '../../../components/wardrobe/wardrobeComponents.tsx';
import { ActionTargetToWardrobeUrl, type WardrobeLocationState } from '../../../components/wardrobe/wardrobeNavigation.tsx';
import { useWardrobeContainerAccessCheck } from '../../../components/wardrobe/wardrobeUtils.ts';
import { TOAST_OPTIONS_WARNING } from '../../../persistentToast.ts';
import { useNavigatePandora } from '../../../routing/navigate.ts';
import { useAccountSettings } from '../../../services/accountLogic/accountManagerHooks.ts';
import { useGameState, useGameStateOptional, useGlobalState, useResolveCharacterName } from '../../../services/gameLogic/gameStateHooks.ts';
import { useRoomScreenContext } from '../../../ui/screens/room/roomContext.tsx';
import { PointLike } from '../../common/point.ts';

type ItemMenuType = 'main' | 'follow';

function HideItemMenu({ roomState, item, close }: {
	roomState: AssetFrameworkRoomState;
	item: Item;
	close: () => void;
}) {
	const action = useMemo((): AppearanceAction => ({
		type: 'moveItem',
		target: { type: 'room', roomId: roomState.id },
		item: { container: [], itemId: item.id },
		personalItemDeployment: { deployed: false },
	}), [item.id, roomState.id]);
	const checkResult = useStaggeredAppearanceActionResult(action, { immediate: true });
	const available = checkResult != null && checkResult.valid;
	const { execute, processing } = useWardrobeExecuteChecked(action, checkResult, { onSuccess: close });

	return (
		<Button
			theme='transparent'
			className={ classNames(
				'withIcon',
				available ? null : 'text-strikethrough',
			) }
			onClick={ execute }
			disabled={ processing }
		>
			<img src={ forbiddenIcon } />
			<span>Hide from room</span>
		</Button>
	);
}

function WearItemMenu({ roomState, item, close }: {
	roomState: AssetFrameworkRoomState;
	item: Item;
	close: () => void;
}): ReactElement | null {
	const player = usePlayer();

	const action = useMemo((): AppearanceAction | null => player != null ? ({
		type: 'transfer',
		source: { type: 'room', roomId: roomState.id },
		item: { container: [], itemId: item.id },
		target: { type: 'character', characterId: player.id },
		container: [],
	}) : null, [item.id, roomState.id, player]);
	const checkResult = useStaggeredAppearanceActionResult(action, { immediate: true });
	const available = checkResult != null && checkResult.valid;
	const { execute, processing } = useWardrobeExecuteChecked(action, checkResult, { onSuccess: close });

	if (action == null || !item.isWearable())
		return null;

	return (
		<Button
			theme='transparent'
			className={ classNames(
				'withIcon',
				available ? null : 'text-strikethrough',
			) }
			onClick={ execute }
			disabled={ processing }
		>
			<img src={ shirtIcon } />
			<span>Wear</span>
		</Button>
	);
}

function MoveItemMenu({ roomState, item, close }: {
	roomState: AssetFrameworkRoomState;
	item: Item;
	close: () => void;
}) {
	const action = useMemo((): AppearanceAction => ({
		type: 'moveItem',
		target: { type: 'room', roomId: roomState.id },
		item: { container: [], itemId: item.id },
		personalItemDeployment: { position: item.isType('personal') ? item.deployment?.position : undefined },
	}), [item, roomState.id]);
	const checkResult = useStaggeredAppearanceActionResult(action, { immediate: true });
	const available = checkResult != null && checkResult.valid;

	const {
		setRoomSceneMode,
	} = useRoomScreenContext();

	const onClick = () => {
		if (checkResult != null && !checkResult.valid && checkResult.prompt == null) {
			toast(<div><ActionProblemsContent problems={ checkResult.problems } prompt={ false } /></div>, TOAST_OPTIONS_WARNING);
			return;
		}
		setRoomSceneMode({ mode: 'moveItem', itemId: item.id });
		close();
	};

	return (
		<Button
			theme='transparent'
			className={ classNames(
				'withIcon',
				available ? null : 'text-strikethrough',
			) }
			onClick={ onClick }
		>
			<img src={ arrowAllIcon } />
			<span>Move</span>
		</Button>
	);
}

function CarryItemMenu({ item, setMenu }: {
	item: Item;
	setMenu: (menu: ItemMenuType) => void;
}): ReactElement | null {
	// Only items that are displayed in the room can be carried
	if (!item.isType('personal') || !item.deployment?.deployed)
		return null;

	return (
		<Button
			theme='transparent'
			className='withIcon'
			onClick={ () => {
				setMenu('follow');
			} }
		>
			<img src={ movementIcon } />
			<span>Carry</span>
		</Button>
	);
}

function StopCarryingMenu({ roomState, item, id, close }: {
	roomState: AssetFrameworkRoomState;
	item: Item;
	id: `c${number}` | null;
	close: () => void;
}): ReactElement | null {
	const action = useMemo((): AppearanceAction => ({
		type: 'moveItem',
		target: { type: 'room', roomId: roomState.id },
		item: { container: [], itemId: item.id },
		personalItemDeployment: { follow: null },
	}), [item.id, roomState.id]);
	const checkResult = useStaggeredAppearanceActionResult(action, { immediate: true });
	const available = checkResult != null && checkResult.valid;
	const { execute, processing } = useWardrobeExecuteChecked(action, checkResult, { onSuccess: close });
	const name = useResolveCharacterName(id) ?? '[unknown]';

	if (!item.isType('personal') || item.deployment?.following == null)
		return null;

	return (
		<>
			<span className='dim'>
				Carried by { name } ({ item.deployment.following.target })
			</span>
			<Button
				theme='transparent'
				className={ classNames(
					'withIcon',
					available ? null : 'text-strikethrough',
				) }
				onClick={ execute }
				disabled={ processing }
			>
				<img src={ movementIcon } />
				<span>Stop carrying</span>
			</Button>
		</>
	);
}

function ItemFollowDialog({ roomState, item, close, setMenu }: {
	roomState: AssetFrameworkRoomState;
	item: Item;
	close: () => void;
	setMenu: (menu: ItemMenuType) => void;
}): ReactElement {
	const id = useId();
	const [mode, setMode] = useState<'relativeLock' | 'hand'>('relativeLock');
	const [hand, setHand] = useState<'left' | 'right'>('right');

	const action = useMemo((): AppearanceAction => ({
		type: 'moveItem',
		target: { type: 'room', roomId: roomState.id },
		item: { container: [], itemId: item.id },
		personalItemDeployment: {
			follow: mode === 'hand' ? { followType: 'hand', hand } : { followType: 'relativeLock' },
		},
	}), [roomState.id, item.id, mode, hand]);

	return (
		<Column>
			<hr className='fill-x' />
			<div>Carry style:</div>
			<Row alignY='center'>
				<Checkbox
					id={ id + ':typeRelativeLock' }
					checked={ mode === 'relativeLock' }
					onChange={ (checked) => {
						if (checked) {
							setMode('relativeLock');
						}
					} }
					radioButton
				/>
				<label htmlFor={ id + ':typeRelativeLock' }>Keep relative position</label>
			</Row>
			<Row alignY='center'>
				<Checkbox
					id={ id + ':typeHand' }
					checked={ mode === 'hand' }
					onChange={ (checked) => {
						if (checked) {
							setMode('hand');
						}
					} }
					radioButton
				/>
				<label htmlFor={ id + ':typeHand' }>Move relative to hand</label>
			</Row>
			{ mode === 'hand' ? (
				<>
					<hr className='fill-x' />
					<div>Hand:</div>
					<Row alignY='center'>
						<Checkbox
							id={ id + ':handLeft' }
							checked={ hand === 'left' }
							onChange={ (checked) => {
								if (checked) {
									setHand('left');
								}
							} }
							radioButton
						/>
						<label htmlFor={ id + ':handLeft' }>Left hand</label>
					</Row>
					<Row alignY='center'>
						<Checkbox
							id={ id + ':handRight' }
							checked={ hand === 'right' }
							onChange={ (checked) => {
								if (checked) {
									setHand('right');
								}
							} }
							radioButton
						/>
						<label htmlFor={ id + ':handRight' }>Right hand</label>
					</Row>
				</>
			) : null }
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
					Carry
				</GameLogicActionButton>
			</Row>
		</Column>
	);
}

function OpenItemStorageMenu({ roomState, item, close }: {
	roomState: AssetFrameworkRoomState;
	item: Item;
	close: () => void;
}) {
	const navigate = useNavigatePandora();

	const storageModuleName = item.asset.definition.storageModule;

	const target = useMemo((): ActionTargetSelector => ({
		type: 'room',
		roomId: roomState.id,
	}), [roomState.id]);

	const container = useMemo((): ItemContainerPath => (
		storageModuleName != null ? [{ item: item.id, module: storageModuleName }] : []
	), [storageModuleName, item.id]);

	const checkResult = useWardrobeContainerAccessCheck(target, container);

	if (storageModuleName == null || !item.getModules().has(storageModuleName))
		return null;

	return (
		<Button
			theme='transparent'
			className={ classNames(
				'withIcon',
				checkResult.valid ? null : 'text-strikethrough',
			) }
			onClick={ () => {
				close();
				navigate(
					ActionTargetToWardrobeUrl({ type: 'room', roomId: roomState.id }),
					{
						state: {
							initialFocus: {
								container,
								itemId: null,
							},
						} satisfies WardrobeLocationState,
					},
				);
			} }>
			<img src={ storageIcon } />
			<span>Open storage</span>
		</Button>
	);
}

function ItemMainMenu({ roomState, item, close, setMenu }: {
	roomState: AssetFrameworkRoomState;
	item: Item;
	close: () => void;
	setMenu: (menu: ItemMenuType) => void;
}) {
	let id = null;

	if (item.isType('personal') && item.deployment?.following != null)
		id = item.deployment.following.target;

	return (
		<>
			<hr />
			<OpenItemStorageMenu roomState={ roomState } item={ item } close={ close } />
			<MoveItemMenu roomState={ roomState } item={ item } close={ close } />
			<CarryItemMenu item={ item } setMenu={ setMenu } />
			<StopCarryingMenu roomState={ roomState } item={ item } id={ id } close={ close } />
			<HideItemMenu roomState={ roomState } item={ item } close={ close } />
			<WearItemMenu roomState={ roomState } item={ item } close={ close } />
		</>
	);
}

function ItemContextMenuCurrent({ roomState, item, position, onClose }: {
	roomState: AssetFrameworkRoomState;
	item: Item;
	position: Readonly<PointLike>;
	onClose: () => void;
}): ReactElement | null {
	const ref = useContextMenuPosition(position);
	const player = usePlayer();
	const gameState = useGameStateOptional();
	const [menu, setMenu] = useState<ItemMenuType>('main');
	const navigate = useNavigatePandora();
	const priority = useContext(DraggableDialogPriorityContext);
	const { wardrobeItemDisplayNameType } = useAccountSettings();

	const onCloseActual = useCallback(() => {
		onClose();
		setMenu('main');
	}, [onClose]);

	if (!player || !gameState) {
		return null;
	}

	return (
		<DialogInPortal priority={ priority }>
			<div className='context-menu' ref={ ref } onPointerDown={ (e) => e.stopPropagation() }>
				<Column overflowY='auto' padding='small'>
					<WardrobeActionContextProvider player={ player }>
						<Button theme='transparent' onClick={ () => {
							onCloseActual();
							navigate(ActionTargetToWardrobeUrl({ type: 'room', roomId: roomState.id }), { state: { initialFocus: { container: [], itemId: item.id } } satisfies WardrobeLocationState });
						} }>
							{ ResolveItemDisplayName(item, wardrobeItemDisplayNameType) }
						</Button>
						{ menu === 'main' && (
							<ItemMainMenu
								roomState={ roomState }
								item={ item }
								close={ onCloseActual }
								setMenu={ setMenu }
							/>
						) }
						{ menu === 'follow' && (
							<ItemFollowDialog
								roomState={ roomState }
								item={ item }
								close={ onCloseActual }
								setMenu={ setMenu }
							/>
						) }
					</WardrobeActionContextProvider>
					{ menu !== 'follow' ? (
						<Button theme='transparent' onClick={ onClose } >
							Close
						</Button>
					) : null }
				</Column>
			</div>
		</DialogInPortal>
	);
}

export function ItemContextMenu({ room, itemId: itemId, position, onClose }: {
	room: RoomId;
	itemId: ItemId;
	position: Readonly<PointLike>;
	onClose: () => void;
}): ReactElement | null {
	const globalState = useGlobalState(useGameState());
	const roomState = globalState.space.getRoom(room);
	const item = useMemo(() => {
		const actual = globalState.getItems({ type: 'room', roomId: room });
		if (!actual)
			return null;

		return EvalItemPath(actual, {
			container: [],
			itemId,
		});
	}, [globalState, room, itemId]);

	useEffect(() => {
		if (roomState == null || !item)
			onClose();
	}, [roomState, item, onClose]);

	if (roomState == null || !item)
		return null;

	return (
		<ItemContextMenuCurrent
			roomState={ roomState }
			item={ item }
			position={ position }
			onClose={ onClose }
		/>
	);
}
