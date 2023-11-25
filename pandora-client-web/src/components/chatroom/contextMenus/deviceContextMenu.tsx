import { nanoid } from 'nanoid';
import { ItemRoomDevice, AppearanceAction, ItemId, ICharacterRoomData } from 'pandora-common';
import React, { useMemo, useState, ReactElement, useEffect, useCallback } from 'react';
import { Character, ICharacter, useCharacterData } from '../../../character/character';
import { ChildrenProps } from '../../../common/reactTypes';
import { PointLike } from '../../../graphics/graphicsCharacter';
import { useContextMenuPosition } from '../../contextMenu';
import { useChatRoomCharacters, useChatroom, useChatroomRequired, useRoomState } from '../../gameContext/chatRoomContextProvider';
import { usePlayer } from '../../gameContext/playerContextProvider';
import { useStaggeredAppearanceActionResult } from '../../wardrobe/wardrobeCheckQueue';
import { useWardrobeContext, useWardrobeExecuteChecked, WardrobeContextProvider } from '../../wardrobe/wardrobeContext';
import { EvalItemPath } from 'pandora-common/dist/assets/appearanceHelpers';
import { CharacterContextMenu } from './characterContextMenu';
import { useConfirmDialog } from '../../dialog/dialog';

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
		deployment: null,
	}), [device]);
	const checkResult = useStaggeredAppearanceActionResult(action, { immediate: true });
	const available = checkResult != null && checkResult.problems.length === 0;
	const [execute, processing] = useWardrobeExecuteChecked(action, checkResult, { onSuccess: close });
	const confirm = useConfirmDialog();

	const onClick = useCallback(() => {
		confirm('Confirm Device Storage', 'Are you sure you want to store the device in the room inventory?')
			.then((result) => {
				if (result) {
					execute();
				}
			}).catch(() => { /* NOOP */});
	}, [confirm, execute]);

	return (
		<button onClick={ onClick } disabled={ processing } className={ available ? '' : 'text-strikethrough' }>
			Store the device
		</button>
	);
}

function DeviceSlotClear({ device, slot, children, close }: ChildrenProps & {
	device: ItemRoomDevice;
	slot: string;
	close: () => void;
}) {
	const action = useMemo<AppearanceAction>(() => ({
		type: 'roomDeviceLeave',
		item: {
			container: [],
			itemId: device.id,
		},
		target: { type: 'roomInventory' },
		slot,
	}), [device, slot]);
	const checkResult = useStaggeredAppearanceActionResult(action, { immediate: true });
	const available = checkResult != null && checkResult.problems.length === 0;
	const [execute, processing] = useWardrobeExecuteChecked(action, checkResult, { onSuccess: close });

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
		target: { type: 'roomInventory' },
		slot,
		character: {
			type: 'character',
			characterId: character.id,
		},
		itemId: `i/${nanoid()}` as const,
	}), [device, slot, character]);
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

function DeviceSlotsMenu({ device, position, close }: {
	device: ItemRoomDevice;
	position: Readonly<PointLike>;
	close: () => void;
}) {
	const [slot, setSlot] = useState<string | null>(null);
	const occupancy = useMemo(() => slot && device.slotOccupancy.get(slot), [device, slot]);
	const { player } = useWardrobeContext();
	const chatRoomCharacters = useChatRoomCharacters();
	const characters = useMemo<readonly ICharacter[]>(() => chatRoomCharacters || [player], [chatRoomCharacters, player]);
	const character = useMemo(() => characters.find(({ id }) => id === occupancy), [characters, occupancy]);
	const [selectedCharacter, setSelectedCharacter] = useState<Character<ICharacterRoomData> | null>(null);
	const onSelectCharacter = useCallback(() => {
		if (!chatRoomCharacters || !character) {
			setSelectedCharacter(null);
			return;
		}
		setSelectedCharacter(chatRoomCharacters.find((c) => c.data.id === character.data.id) ?? null);
	}, [chatRoomCharacters, character]);

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

function DeviceContextMenuCurrent({ device, position, onClose }: {
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
						<DeviceSlotsMenu device={ device } position={ position } close={ onClose } />
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

export function DeviceContextMenu({ deviceItemId, position, onClose }: {
	deviceItemId: ItemId;
	position: Readonly<PointLike>;
	onClose: () => void;
}): ReactElement | null {
	const globalState = useRoomState(useChatroomRequired());
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
		<DeviceContextMenuCurrent device={ item } position={ position } onClose={ onClose } />
	);
}
