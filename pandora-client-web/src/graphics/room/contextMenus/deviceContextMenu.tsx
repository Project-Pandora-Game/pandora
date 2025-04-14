import { omit } from 'lodash-es';
import { nanoid } from 'nanoid';
import { AppearanceAction, CHARACTER_SETTINGS_DEFAULT, EvalItemPath, ItemId, ItemRoomDevice, type ICharacterRoomData } from 'pandora-common';
import { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { ICharacter, useCharacterData, useCharacterDataOptional } from '../../../character/character.ts';
import { ChildrenProps } from '../../../common/reactTypes.ts';
import { Column } from '../../../components/common/container/container.tsx';
import { Scrollable } from '../../../components/common/scrollbar/scrollbar.tsx';
import { useContextMenuPosition } from '../../../components/contextMenu/index.ts';
import { DialogInPortal } from '../../../components/dialog/dialog.tsx';
import { useGameState, useGameStateOptional, useGlobalState, useSpaceCharacters } from '../../../components/gameContext/gameStateContextProvider.tsx';
import { usePlayer } from '../../../components/gameContext/playerContextProvider.tsx';
import type { WardrobeLocationState } from '../../../components/wardrobe/wardrobe.tsx';
import { useWardrobeActionContext, useWardrobeExecuteChecked, WardrobeActionContextProvider } from '../../../components/wardrobe/wardrobeActionContext.tsx';
import { useStaggeredAppearanceActionResult } from '../../../components/wardrobe/wardrobeCheckQueue.ts';
import { ActionWarningContent } from '../../../components/wardrobe/wardrobeComponents.tsx';
import { PointLike } from '../../../graphics/graphicsCharacter.tsx';
import { TOAST_OPTIONS_WARNING } from '../../../persistentToast.ts';
import { useNavigatePandora } from '../../../routing/navigate.ts';
import { useRoomScreenContext } from '../../../ui/screens/room/roomContext.tsx';
import { useIsRoomConstructionModeEnabled } from '../roomDevice.tsx';

function StoreDeviceMenu({ device, close }: {
	device: ItemRoomDevice;
	close: () => void;
}) {
	const action = useMemo<AppearanceAction>(() => ({
		type: 'roomDeviceDeploy',
		item: {
			container: [],
			itemId: device.id,
		},
		target: { type: 'roomInventory' },
		deployment: { deployed: false },
	}), [device]);
	const checkResult = useStaggeredAppearanceActionResult(action, { immediate: true });
	const roomConstructionMode = useIsRoomConstructionModeEnabled();
	const available = roomConstructionMode && checkResult != null && checkResult.valid;
	const { execute, processing } = useWardrobeExecuteChecked(action, checkResult, { onSuccess: close });

	const onClick = () => {
		if (!roomConstructionMode) {
			toast('You must be in room construction mode to store devices', TOAST_OPTIONS_WARNING);
			return;
		}
		execute();
	};

	return (
		<button onClick={ onClick } disabled={ processing } className={ available ? '' : 'text-strikethrough' }>
			Store the device
		</button>
	);
}

function MoveDeviceMenu({ device, close }: {
	device: ItemRoomDevice;
	close: () => void;
}) {
	const action = useMemo((): AppearanceAction => ({
		type: 'roomDeviceDeploy',
		item: {
			container: [],
			itemId: device.id,
		},
		target: { type: 'roomInventory' },
		deployment: { deployed: true, position: omit(device.deployment, 'deployed') },
	}), [device]);
	const checkResult = useStaggeredAppearanceActionResult(action, { immediate: true });
	const roomConstructionMode = useIsRoomConstructionModeEnabled();
	const available = roomConstructionMode && checkResult != null && checkResult.valid;

	const {
		setRoomSceneMode,
	} = useRoomScreenContext();

	const onClick = () => {
		if (!roomConstructionMode) {
			toast('You must be in room construction mode to move devices', TOAST_OPTIONS_WARNING);
			return;
		}
		if (checkResult != null && !checkResult.valid && checkResult.prompt == null) {
			toast(<ActionWarningContent problems={ checkResult.problems } prompt={ false } />, TOAST_OPTIONS_WARNING);
			return;
		}
		setRoomSceneMode({ mode: 'moveDevice', deviceItemId: device.id });
		close();
	};

	return (
		<button onClick={ onClick } className={ available ? '' : 'text-strikethrough' }>
			Move
		</button>
	);
}

function DeviceSlotClear({ device, slot, children, close }: ChildrenProps & {
	device: ItemRoomDevice;
	slot: string;
	close: () => void;
}) {
	const action = useMemo((): AppearanceAction => ({
		type: 'roomDeviceLeave',
		item: {
			container: [],
			itemId: device.id,
		},
		target: { type: 'roomInventory' },
		slot,
	}), [device, slot]);
	const checkResult = useStaggeredAppearanceActionResult(action, { immediate: true });
	const available = checkResult != null && checkResult.valid;
	const { execute, processing } = useWardrobeExecuteChecked(action, checkResult, { onSuccess: close });

	return (
		<button onClick={ execute } disabled={ processing } className={ available ? '' : 'text-strikethrough' }>
			{ children }
		</button>
	);
}

function LeaveDeviceMenu({ device, close }: {
	device: ItemRoomDevice;
	close: () => void;
}) {
	const { player } = useWardrobeActionContext();
	const slot = useMemo(() => [...device.slotOccupancy.entries()].find(([, id]) => id === player.id)?.[0], [device, player]);
	if (!slot)
		return null;

	return (
		<DeviceSlotClear device={ device } slot={ slot } close={ close }>
			Exit the device
		</DeviceSlotClear>
	);
}

function OccupyDeviceSlotMenu({ device, slot, character, close }: {
	device: ItemRoomDevice;
	slot: string;
	character: ICharacter<ICharacterRoomData>;
	close: () => void;
}) {
	const characterData = useCharacterData(character);

	const action = useMemo((): AppearanceAction => ({
		type: 'roomDeviceEnter',
		item: {
			container: [],
			itemId: device.id,
		},
		target: { type: 'roomInventory' },
		slot,
		character: {
			type: 'character',
			characterId: character.id,
		},
		itemId: `i/${nanoid()}` as const,
	}), [device, slot, character]);
	const checkResult = useStaggeredAppearanceActionResult(action, { immediate: true });
	const available = checkResult != null && checkResult.valid;
	const { execute, processing } = useWardrobeExecuteChecked(action, checkResult, { onSuccess: close });

	return (
		<button
			onClick={ execute }
			disabled={ processing }
			className={ available ? '' : 'text-strikethrough' }
			style={ {
				backgroundColor: `${characterData.publicSettings.labelColor ?? CHARACTER_SETTINGS_DEFAULT.labelColor}44`,
			} }
		>
			{ character.name } ({ character.id })
		</button>
	);
}

function DeviceSlotMenu({ slot, device, position, close, closeSlot }: {
	slot: string;
	device: ItemRoomDevice;
	position: Readonly<PointLike>;
	close: () => void;
	closeSlot: () => void;
}) {
	const occupancy = useMemo(() => device.slotOccupancy.get(slot), [device, slot]);
	const characters = useSpaceCharacters();
	const character = useMemo(() => characters.find(({ id }) => id === occupancy), [characters, occupancy]);
	const characterData = useCharacterDataOptional(character ?? null);

	const {
		openContextMenu,
	} = useRoomScreenContext();

	const onSelectCharacter = useCallback(() => {
		if (!character) {
			return;
		}
		openContextMenu(character, position);
	}, [character, position, openContextMenu]);

	if (occupancy) {
		return (
			<>
				<span>
					{ device.asset.definition.slots[slot].name }
				</span>
				<hr />
				<button
					onClick={ onSelectCharacter }
					style={ {
						backgroundColor: characterData != null ? `${characterData.publicSettings.labelColor ?? CHARACTER_SETTINGS_DEFAULT.labelColor}44` : undefined,
					} }
				>
					{ character?.name } ({ occupancy })
				</button>
				<hr />
				<DeviceSlotClear device={ device } slot={ slot } close={ close }>
					{ (character)
						? 'Exit the device'
						: 'Clear occupancy of the slot' }
				</DeviceSlotClear>
				<button onClick={ closeSlot }>
					Back
				</button>
			</>
		);
	}

	return (
		<>
			<span>
				{ device.asset.definition.slots[slot].name }
			</span>
			<hr />
			<span>
				Enter:
			</span>
			{ characters.map((char) => (
				<OccupyDeviceSlotMenu key={ char.id } device={ device } slot={ slot } character={ char } close={ close } />
			)) }
			<hr />
			<button onClick={ closeSlot }>
				Back
			</button>
		</>
	);
}

function DeviceMainMenu({ device, position, close }: {
	device: ItemRoomDevice;
	position: Readonly<PointLike>;
	close: () => void;
}) {
	const [slot, setSlot] = useState<string | null>(null);

	if (!slot) {
		return (
			<>
				{ Object.keys(device.asset.definition.slots).length > 0 ? (<hr />) : null }
				{ Object.entries(device.asset.definition.slots).map(([name, definition]) => (
					<button key={ name } onClick={ () => setSlot(name) }>
						{ definition.name }
					</button>
				)) }
				<hr />
				<LeaveDeviceMenu device={ device } close={ close } />
				<MoveDeviceMenu device={ device } close={ close } />
				<StoreDeviceMenu device={ device } close={ close } />
			</>
		);
	}

	return (
		<DeviceSlotMenu
			slot={ slot }
			device={ device }
			position={ position }
			close={ close }
			closeSlot={ () => setSlot(null) }
		/>
	);
}

function DeviceContextMenuCurrent({ device, position, onClose }: {
	device: ItemRoomDevice;
	position: Readonly<PointLike>;
	onClose: () => void;
}): ReactElement | null {
	const ref = useContextMenuPosition(position);
	const player = usePlayer();
	const gameState = useGameStateOptional();
	const [menu, setMenu] = useState<'main'>('main');
	const navigate = useNavigatePandora();

	const onCloseActual = useCallback(() => {
		setMenu('main');
		onClose();
	}, [onClose]);

	if (!player || !gameState) {
		return null;
	}

	return (
		<DialogInPortal>
			<div className='context-menu' ref={ ref } onPointerDown={ (e) => e.stopPropagation() }>
				<Scrollable>
					<Column>
						<WardrobeActionContextProvider player={ player }>
							<button onClick={ () => {
								onCloseActual();
								navigate('/wardrobe/room-inventory', { state: { initialFocus: { container: [], itemId: device.id } } satisfies WardrobeLocationState });
							} }>
								{ device.asset.definition.name }
							</button>
							{ menu === 'main' && (
								<DeviceMainMenu
									device={ device }
									position={ position }
									close={ onCloseActual }
								/>
							) }
						</WardrobeActionContextProvider>
						<button onClick={ onClose } >
							Close
						</button>
					</Column>
				</Scrollable>
			</div>
		</DialogInPortal>
	);
}

export function DeviceContextMenu({ deviceItemId, position, onClose }: {
	deviceItemId: ItemId;
	position: Readonly<PointLike>;
	onClose: () => void;
}): ReactElement | null {
	const globalState = useGlobalState(useGameState());
	const item = useMemo(() => {
		const actual = globalState.getItems({ type: 'roomInventory' });
		if (!actual)
			return null;

		return EvalItemPath(actual, {
			container: [],
			itemId: deviceItemId,
		});
	}, [globalState, deviceItemId]);

	useEffect(() => {
		if (!item?.isType('roomDevice'))
			onClose();
	}, [item, onClose]);

	if (!item?.isType('roomDevice'))
		return null;

	return (
		<DeviceContextMenuCurrent
			device={ item }
			position={ position }
			onClose={ onClose }
		/>
	);
}
