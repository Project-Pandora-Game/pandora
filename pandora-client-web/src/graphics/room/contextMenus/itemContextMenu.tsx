import classNames from 'classnames';
import { AppearanceAction, EvalItemPath, ItemId, type AssetFrameworkRoomState, type Item, type RoomId } from 'pandora-common';
import { ReactElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import arrowAllIcon from '../../../assets/icons/arrow_all.svg';
import forbiddenIcon from '../../../assets/icons/forbidden.svg';
import { Button } from '../../../components/common/button/button.tsx';
import { Column } from '../../../components/common/container/container.tsx';
import { useContextMenuPosition } from '../../../components/contextMenu/index.ts';
import { DialogInPortal, DraggableDialogPriorityContext } from '../../../components/dialog/dialog.tsx';
import { usePlayer } from '../../../components/gameContext/playerContextProvider.tsx';
import { ResolveItemDisplayName } from '../../../components/wardrobe/itemDetail/wardrobeItemName.tsx';
import { useWardrobeExecuteChecked, WardrobeActionContextProvider } from '../../../components/wardrobe/wardrobeActionContext.tsx';
import { ActionProblemsContent } from '../../../components/wardrobe/wardrobeActionProblems.tsx';
import { useStaggeredAppearanceActionResult } from '../../../components/wardrobe/wardrobeCheckQueue.ts';
import { ActionTargetToWardrobeUrl, type WardrobeLocationState } from '../../../components/wardrobe/wardrobeNavigation.tsx';
import { TOAST_OPTIONS_WARNING } from '../../../persistentToast.ts';
import { useNavigatePandora } from '../../../routing/navigate.ts';
import { useAccountSettings } from '../../../services/accountLogic/accountManagerHooks.ts';
import { useGameState, useGameStateOptional, useGlobalState } from '../../../services/gameLogic/gameStateHooks.ts';
import { useRoomScreenContext } from '../../../ui/screens/room/roomContext.tsx';
import { PointLike } from '../../common/point.ts';

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
				available ? '' : 'text-strikethrough',
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
				available ? '' : 'text-strikethrough',
			) }
			onClick={ execute }
			disabled={ processing }
		>
			<div className='icon'>⇪</div><span>Wear item</span>
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
			toast(<ActionProblemsContent problems={ checkResult.problems } prompt={ false } />, TOAST_OPTIONS_WARNING);
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
				available ? '' : 'text-strikethrough',
			) }
			onClick={ onClick }
		>
			<img src={ arrowAllIcon } />
			<span>Move</span>
		</Button>
	);
}

function ItemMainMenu({ roomState, item, close }: {
	roomState: AssetFrameworkRoomState;
	item: Item;
	close: () => void;
}) {
	return (
		<>
			<hr />
			<MoveItemMenu roomState={ roomState } item={ item } close={ close } />
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
	const [menu, setMenu] = useState<'main'>('main');
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
							/>
						) }
					</WardrobeActionContextProvider>
					<Button theme='transparent' onClick={ onClose } >
						Close
					</Button>
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
