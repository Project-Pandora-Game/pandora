import { Immutable } from 'immer';
import { omit } from 'lodash';
import { nanoid } from 'nanoid';
import { AppearanceAction, ICharacterRoomData, ItemId, ItemRoomDevice, RoomId } from 'pandora-common';
import { EvalItemPath } from 'pandora-common/dist/assets/appearanceHelpers';
import React, { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { Character, ICharacter, useCharacterData } from '../../../character/character';
import { ChildrenProps } from '../../../common/reactTypes';
import { useContextMenuPosition } from '../../../components/contextMenu';
import { useGameState, useGameStateOptional, useGlobalState, useSpaceCharacters } from '../../../components/gameContext/gameStateContextProvider';
import { usePlayer } from '../../../components/gameContext/playerContextProvider';
import { useStaggeredAppearanceActionResult } from '../../../components/wardrobe/wardrobeCheckQueue';
import { ActionWarningContent } from '../../../components/wardrobe/wardrobeComponents';
import { WardrobeContextProvider, useWardrobeContext, useWardrobeExecuteChecked } from '../../../components/wardrobe/wardrobeContext';
import { PointLike } from '../../../graphics/graphicsCharacter';
import { TOAST_OPTIONS_WARNING } from '../../../persistentToast';
import { useIsRoomConstructionModeEnabled } from '../roomDevice';
import { IRoomSceneMode } from '../roomScene';
import { CharacterContextMenu } from './characterContextMenu';

function MoveDeviceMenu({ device, roomId, setRoomSceneMode, close }: {
	device: ItemRoomDevice;
	roomId: RoomId;
	setRoomSceneMode: (newMode: Immutable<IRoomSceneMode>) => void;
	close: () => void;
}) {
	const action = useMemo<AppearanceAction>(() => ({
		type: 'roomDeviceDeploy',
		item: {
			container: [],
			itemId: device.id,
		},
		target: { type: 'room', roomId },
		deployment: { deployed: true, position: omit(device.deployment, 'deployed') },
	}), [device, roomId]);
	const checkResult = useStaggeredAppearanceActionResult(action, { immediate: true });
	const roomConstructionMode = useIsRoomConstructionModeEnabled();
	const available = roomConstructionMode && checkResult != null && checkResult.problems.length === 0;

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

function DeviceSlotClear({ device, roomId, slot, children, close }: ChildrenProps & {
	device: ItemRoomDevice;
	roomId: RoomId;
	slot: string;
	close: () => void;
}) {
	const action = useMemo<AppearanceAction>(() => ({
		type: 'roomDeviceLeave',
		item: {
			container: [],
			itemId: device.id,
		},
		target: { type: 'room', roomId },
		slot,
	}), [device, roomId, slot]);
	const checkResult = useStaggeredAppearanceActionResult(action, { immediate: true });
	const available = checkResult != null && checkResult.problems.length === 0;
	const [execute, processing] = useWardrobeExecuteChecked(action, checkResult, { onSuccess: close });

	return (
		<button onClick={ execute } disabled={ processing } className={ available ? '' : 'text-strikethrough' }>
			{ children }
		</button>
	);
}

function LeaveDeviceMenu({ device, roomId, close }: {
	device: ItemRoomDevice;
	roomId: RoomId;
	close: () => void;
}) {
	const { player } = useWardrobeContext();
	const slot = useMemo(() => [...device.slotOccupancy.entries()].find(([, id]) => id === player.id)?.[0], [device, player]);
	if (!slot)
		return null;

	return (
		<DeviceSlotClear device={ device } roomId={ roomId } slot={ slot } close={ close }>
			Exit the device
		</DeviceSlotClear>
	);
}

function OccupyDeviceSlotMenu({ device, roomId, slot, character, close }: {
	device: ItemRoomDevice;
	roomId: RoomId;
	slot: string;
	character: ICharacter;
	close: () => void;
}) {
	const characterData = useCharacterData(character);

	const action = useMemo<AppearanceAction>(() => ({
		type: 'roomDeviceEnter',
		item: {
			container: [],
			itemId: device.id,
		},
		target: { type: 'room', roomId },
		slot,
		character: {
			type: 'character',
			characterId: character.id,
		},
		itemId: `i/${nanoid()}` as const,
	}), [device, roomId, slot, character]);
	const checkResult = useStaggeredAppearanceActionResult(action, { immediate: true });
	const available = checkResult != null && checkResult.problems.length === 0;
	const [execute, processing] = useWardrobeExecuteChecked(action, checkResult, { onSuccess: close });

	return (
		<button
			onClick={ execute }
			disabled={ processing }
			className={ available ? '' : 'text-strikethrough' }
			style={ {
				backgroundColor: `${characterData.settings.labelColor}44`,
			} }
		>
			{ character.name } ({ character.id })
		</button>
	);
}

function DeviceSlotsMenu({ device, roomId, position, close }: {
	device: ItemRoomDevice;
	roomId: RoomId;
	position: Readonly<PointLike>;
	close: () => void;
}) {
	const [slot, setSlot] = useState<string | null>(null);
	const occupancy = useMemo(() => slot && device.slotOccupancy.get(slot), [device, slot]);
	const characters = useSpaceCharacters();
	const character = useMemo(() => characters.find(({ id }) => id === occupancy), [characters, occupancy]);
	const [selectedCharacter, setSelectedCharacter] = useState<Character<ICharacterRoomData> | null>(null);
	const onSelectCharacter = useCallback(() => {
		if (!characters || !character) {
			setSelectedCharacter(null);
			return;
		}
		setSelectedCharacter(characters.find((c) => c.data.id === character.data.id) ?? null);
	}, [characters, character]);

	if (selectedCharacter) {
		return (
			<CharacterContextMenu
				character={ selectedCharacter }
				position={ position }
				onClose={ () => setSelectedCharacter(null) }
				closeText='Back to slots'
			/>
		);
	}

	if (!slot) {
		return (
			<>
				{ Object.entries(device.asset.definition.slots).map(([name, definition]) => (
					<button key={ name } onClick={ () => setSlot(name) }>
						{ definition.name }
					</button>
				)) }
			</>
		);
	}

	if (occupancy) {
		return (
			<>
				<span>
					{ device.asset.definition.slots[slot].name }
				</span>
				<button onClick={ onSelectCharacter }>
					{ character?.name } ({ character?.id })
				</button>
				<DeviceSlotClear device={ device } roomId={ roomId } slot={ slot } close={ close }>
					{ (character)
						? 'Exit the device'
						: 'Clear occupancy of the slot' }
				</DeviceSlotClear>
				<button onClick={ () => setSlot(null) }>
					Back to slots
				</button>
			</>
		);
	}

	return (
		<>
			<span>
				{ device.asset.definition.slots[slot].name }
			</span>
			<span>
				Enter:
			</span>
			{ characters.map((char) => (
				<OccupyDeviceSlotMenu key={ char.id } device={ device } roomId={ roomId } slot={ slot } character={ char } close={ close } />
			)) }
			<button onClick={ () => setSlot(null) }>
				Back to slots
			</button>
		</>
	);
}

function DeviceContextMenuCurrent({ device, roomId, position, setRoomSceneMode, onClose }: {
	device: ItemRoomDevice;
	roomId: RoomId;
	position: Readonly<PointLike>;
	roomSceneMode: Immutable<IRoomSceneMode>;
	setRoomSceneMode: (newMode: Immutable<IRoomSceneMode>) => void;
	onClose: () => void;
}): ReactElement | null {
	const ref = useContextMenuPosition(position);
	const player = usePlayer();
	const gameState = useGameStateOptional();
	const [menu, setMenu] = useState<'main' | 'slots'>('main');

	if (!player || !gameState) {
		return null;
	}

	return (
		<div className='context-menu' ref={ ref } onPointerDown={ (e) => e.stopPropagation() }>
			<span>
				{ device.asset.definition.name }
			</span>
			<WardrobeContextProvider target={ { type: 'room', roomId } } player={ player }>
				{ menu === 'main' && (
					<>
						<LeaveDeviceMenu device={ device } roomId={ roomId } close={ onClose } />
						<button onClick={ () => setMenu('slots') }>
							Slots
						</button>
						<MoveDeviceMenu device={ device } roomId={ roomId } setRoomSceneMode={ setRoomSceneMode } close={ onClose } />
					</>
				) }
				{ menu === 'slots' && (
					<>
						<DeviceSlotsMenu device={ device } roomId={ roomId } position={ position } close={ onClose } />
						<button onClick={ () => setMenu('main') }>
							Back
						</button>
					</>
				) }
			</WardrobeContextProvider>
			<button onClick={ onClose } >
				Close
			</button>
		</div>
	);
}

export function DeviceContextMenu({ deviceItemId, roomId, position, roomSceneMode, setRoomSceneMode, onClose }: {
	deviceItemId: ItemId;
	roomId: RoomId;
	position: Readonly<PointLike>;
	roomSceneMode: Immutable<IRoomSceneMode>;
	setRoomSceneMode: (newMode: Immutable<IRoomSceneMode>) => void;
	onClose: () => void;
}): ReactElement | null {
	const globalState = useGlobalState(useGameState());
	const item = useMemo(() => {
		const actual = globalState.getItems({ type: 'room', roomId });
		if (!actual)
			return null;

		return EvalItemPath(actual, {
			container: [],
			itemId: deviceItemId,
		});
	}, [globalState, roomId, deviceItemId]);

	useEffect(() => {
		if (!item?.isType('roomDevice'))
			onClose();
	}, [item, onClose]);

	if (!item?.isType('roomDevice'))
		return null;

	return (
		<DeviceContextMenuCurrent
			device={ item }
			roomId={ roomId }
			position={ position }
			roomSceneMode={ roomSceneMode }
			setRoomSceneMode={ setRoomSceneMode }
			onClose={ onClose }
		/>
	);
}
