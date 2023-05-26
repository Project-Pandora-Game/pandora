import { nanoid } from 'nanoid';
import { ItemRoomDevice, AppearanceAction } from 'pandora-common';
import React, { useMemo, useCallback, useState, ReactElement } from 'react';
import { AppearanceContainer } from '../../../character/character';
import { ChildrenProps } from '../../../common/reactTypes';
import { PointLike } from '../../../graphics/graphicsCharacter';
import { useContextMenuPosition } from '../../contextMenu';
import { useChatRoomCharacters, useChatroom } from '../../gameContext/chatRoomContextProvider';
import { usePlayer } from '../../gameContext/playerContextProvider';
import { useStaggeredAppearanceActionResult, useWardrobeContext, WardrobeContextProvider } from '../../wardrobe/wardrobe';

function StoreDeviceMenu({ device, close }: {
	device: ItemRoomDevice;
	close: () => void;
}) {
	const { execute } = useWardrobeContext();
	const action = useMemo<AppearanceAction>(() => ({
		type: 'roomDeviceDeploy',
		item: {
			container: [],
			itemId: device.id,
		},
		target: { type: 'roomInventory' },
		deployment: null,
	}), [device]);
	const available = useStaggeredAppearanceActionResult(action, { immediate: true })?.result === 'success';
	const onClick = useCallback(() => {
		execute(action);
		close();
	}, [action, execute, close]);

	if (!available) {
		return null;
	}

	return (
		<button onClick={ onClick }>
			Store the device
		</button>
	);
}

function DeviceSlotClear({ device, slot, children, close }: ChildrenProps & {
	device: ItemRoomDevice;
	slot: string;
	close: () => void;
}) {
	const { execute } = useWardrobeContext();
	const action = useMemo<AppearanceAction>(() => ({
		type: 'roomDeviceLeave',
		item: {
			container: [],
			itemId: device.id,
		},
		target: { type: 'roomInventory' },
		slot,
	}), [device, slot]);
	const available = useStaggeredAppearanceActionResult(action, { immediate: true })?.result === 'success';
	const onClick = useCallback(() => {
		if (action)
			execute(action);

		close();
	}, [action, execute, close]);

	if (!available) {
		return null;
	}

	return (
		<button onClick={ onClick }>
			{ children }
		</button>
	);
}

function LeaveDeviceMenu({ device, close }: {
	device: ItemRoomDevice;
	close: () => void;
}) {
	const { player } = useWardrobeContext();
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
	character: AppearanceContainer;
	close: () => void;
}) {
	const { execute } = useWardrobeContext();
	const action = useMemo<AppearanceAction>(() => ({
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
	const available = useStaggeredAppearanceActionResult(action, { immediate: true })?.result === 'success';
	const onClick = useCallback(() => {
		execute(action);
		close();
	}, [action, execute, close]);

	if (!available) {
		return null;
	}

	return (
		<button onClick={ onClick }>
			{ character.name } ({ character.id })
		</button>
	);
}

function DeviceSlotsMenu({ device }: {
	device: ItemRoomDevice;
	close: () => void;
}) {
	const [slot, setSlot] = useState<string | null>(null);
	const occupancy = useMemo(() => slot && device.slotOccupancy.get(slot), [device, slot]);
	const { player } = useWardrobeContext();
	const chatRoomCharacters = useChatRoomCharacters();
	const characters = useMemo<readonly AppearanceContainer[]>(() => chatRoomCharacters || [player], [chatRoomCharacters, player]);
	const character = useMemo(() => characters.find(({ id }) => id === occupancy), [characters, occupancy]);

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
				<span>
					{ character?.name } ({ character?.id })
				</span>
				<DeviceSlotClear device={ device } slot={ slot } close={ close }>
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
				<OccupyDeviceSlotMenu key={ char.id } device={ device } slot={ slot } character={ char } close={ close } />
			)) }
			<button onClick={ () => setSlot(null) }>
				Back to slots
			</button>
		</>
	);
}

export function DeviceContextMenu({ device, position, onClose }: {
	device: ItemRoomDevice;
	position: Readonly<PointLike>;
	onClose: () => void;
}): ReactElement | null {
	const ref = useContextMenuPosition(position);
	const player = usePlayer();
	const chatRoom = useChatroom();
	const [menu, setMenu] = useState<'main' | 'slots'>('main');

	if (!player || !chatRoom) {
		return null;
	}

	return (
		<div className='context-menu' ref={ ref } onPointerDown={ (e) => e.stopPropagation() }>
			<span>
				{ device.asset.definition.name }
			</span>
			<WardrobeContextProvider target={ chatRoom } player={ player }>
				{ menu === 'main' && (
					<>
						<LeaveDeviceMenu device={ device } close={ onClose } />
						<button onClick={ () => setMenu('slots') }>
							Slots
						</button>
						<StoreDeviceMenu device={ device } close={ onClose } />
					</>
				) }
				{ menu === 'slots' && (
					<>
						<DeviceSlotsMenu device={ device } close={ onClose } />
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
