import { Immutable } from 'immer';
import _ from 'lodash';
import { nanoid } from 'nanoid';
import {
	CharacterId,
	CharacterIdSchema,
	Item,
	ItemPath,
	RoomDeviceDeploymentPosition,
	RoomDeviceSlot,
} from 'pandora-common';
import { ReactElement, ReactNode, useCallback, useMemo, useState } from 'react';
import { ICharacter } from '../../../character/character';
import { NumberInput } from '../../../common/userInteraction/input/numberInput';
import { Select } from '../../../common/userInteraction/select/select';
import { useUpdatedUserInput } from '../../../common/useSyncUserInput';
import { LIVE_UPDATE_THROTTLE } from '../../../config/Environment';
import { Column, Row } from '../../common/container/container';
import { FieldsetToggle } from '../../common/fieldsetToggle';
import { useSpaceCharacters } from '../../gameContext/gameStateContextProvider';
import { WardrobeModuleConfig } from '../modules/_wardrobeModules';
import { useWardrobeActionContext, useWardrobeExecuteCallback } from '../wardrobeActionContext';
import { useStaggeredAppearanceActionResult } from '../wardrobeCheckQueue';
import { WardrobeActionButton } from '../wardrobeComponents';
import { WardrobeContextSelectRoomInventoryProvider, useWardrobeContext } from '../wardrobeContext';

export function WardrobeRoomDeviceDeployment({ roomDevice, item }: {
	roomDevice: Item<'roomDevice'>;
	item: ItemPath;
}): ReactElement | null {
	const { targetSelector } = useWardrobeContext();

	let contents: ReactElement | undefined;

	if (roomDevice.isDeployed()) {
		contents = (
			<>
				<WardrobeActionButton action={ {
					type: 'roomDeviceDeploy',
					target: targetSelector,
					item,
					deployment: { deployed: false },
				} }>
					Store the device
				</WardrobeActionButton>
				<WardrobeRoomDeviceDeploymentPosition deployment={ roomDevice.deployment } item={ item } />
			</>
		);
	} else {
		contents = (
			<WardrobeActionButton action={ {
				type: 'roomDeviceDeploy',
				target: targetSelector,
				item,
				deployment: { deployed: true },
			} }>
				Deploy the device
			</WardrobeActionButton>
		);
	}

	return (
		<FieldsetToggle legend='Deployment'>
			<Column padding='medium'>
				{ contents }
			</Column>
		</FieldsetToggle>
	);
}

function WardrobeRoomDeviceDeploymentPosition({ deployment, item }: {
	deployment: NonNullable<Immutable<RoomDeviceDeploymentPosition>>;
	item: ItemPath;
}): ReactElement | null {
	const { targetSelector } = useWardrobeContext();
	const [execute] = useWardrobeExecuteCallback({ allowMultipleSimultaneousExecutions: true });

	const [positionX, setPositionX] = useUpdatedUserInput(deployment.x, [item]);
	const [positionY, setPositionY] = useUpdatedUserInput(deployment.y, [item]);
	const [positionYOffset, setPositionYOffset] = useUpdatedUserInput(deployment.yOffset, [item]);

	const checkResult = useStaggeredAppearanceActionResult({
		type: 'roomDeviceDeploy',
		target: targetSelector,
		item,
		deployment: { deployed: true, position: deployment },
	});
	const disabled = checkResult == null || !checkResult.valid || checkResult.getActionSlowdownTime() > 0;

	const onChangeCaller = useCallback((newPosition: Immutable<RoomDeviceDeploymentPosition>) => {
		execute({
			type: 'roomDeviceDeploy',
			target: targetSelector,
			item,
			deployment: { deployed: true, position: newPosition },
		});
	}, [execute, targetSelector, item]);
	const onChangeCallerThrottled = useMemo(() => _.throttle(onChangeCaller, LIVE_UPDATE_THROTTLE), [onChangeCaller]);

	const changeCallback = useCallback((positionChange: Partial<RoomDeviceDeploymentPosition>) => {
		const newPosition: Immutable<RoomDeviceDeploymentPosition> = {
			...deployment,
			...positionChange,
		};
		setPositionX(newPosition.x);
		setPositionY(newPosition.y);
		setPositionYOffset(newPosition.yOffset);
		onChangeCallerThrottled(newPosition);
	}, [deployment, setPositionX, setPositionY, setPositionYOffset, onChangeCallerThrottled]);

	return (
		<Column padding='medium' alignY='center'>
			<Row alignY='center'>
				<label>X:</label>
				<NumberInput
					className='positioning-input flex-1'
					value={ positionX }
					onChange={ (newValue) => {
						changeCallback({ x: newValue });
					} }
					disabled={ disabled }
				/>
				<label>Y:</label>
				<NumberInput
					className='positioning-input flex-1'
					value={ positionY }
					onChange={ (newValue) => {
						changeCallback({ y: newValue });
					} }
					disabled={ disabled }
				/>
			</Row>
			<Row alignY='center'>
				<label>Y offset:</label>
				<NumberInput
					className='positioning-input flex-1'
					value={ positionYOffset }
					onChange={ (newValue) => {
						changeCallback({ yOffset: newValue });
					} }
					disabled={ disabled }
				/>
			</Row>
		</Column>
	);
}

export function WardrobeRoomDeviceSlots({ roomDevice, item }: {
	roomDevice: Item<'roomDevice'>;
	item: ItemPath;
}): ReactElement | null {
	let contents: ReactNode;

	if (roomDevice.isDeployed()) {
		contents = Object.entries(roomDevice.asset.definition.slots).map(([slotName, slotDefinition]) => (
			<WardrobeRoomDeviceSlot key={ slotName }
				item={ item }
				slotName={ slotName }
				slotDefinition={ slotDefinition }
				occupancy={ roomDevice.slotOccupancy.get(slotName) ?? null }
			/>
		));
	} else {
		contents = 'Device must be deployed to interact with slots';
	}

	if (Object.entries(roomDevice.asset.definition.slots).length === 0)
		return null;

	return (
		<FieldsetToggle legend='Slots'>
			<Column padding='medium'>
				{ contents }
			</Column>
		</FieldsetToggle>
	);
}

function WardrobeRoomDeviceSlot({ slotName, slotDefinition, occupancy, item }: {
	slotName: string;
	slotDefinition: RoomDeviceSlot;
	occupancy: CharacterId | null;
	item: ItemPath;
}): ReactElement | null {
	const { player } = useWardrobeActionContext();
	const { targetSelector } = useWardrobeContext();

	const characters: readonly ICharacter[] = useSpaceCharacters();

	let contents: ReactNode;

	const [selectedCharacter, setSelectedCharacter] = useState<CharacterId>(player.id);

	if (occupancy == null) {
		contents = (
			<>
				<span>Empty</span>
				<Select value={ selectedCharacter } onChange={
					(event) => {
						const characterId = CharacterIdSchema.parse(event.target.value);
						setSelectedCharacter(characterId);
					}
				}>
					{
						characters.map((character) => <option key={ character.id } value={ character.id }>{ character.name } ({ character.id })</option>)
					}
				</Select>
				<WardrobeActionButton action={ {
					type: 'roomDeviceEnter',
					target: targetSelector,
					item,
					slot: slotName,
					character: {
						type: 'character',
						characterId: selectedCharacter,
					},
					itemId: `i/${nanoid()}` as const,
				} }>
					Enter the device
				</WardrobeActionButton>
			</>
		);

	} else {
		const character = characters.find((c) => c.id === occupancy);

		const characterDescriptor = character ? `${character.name} (${character.id})` : `[UNKNOWN] (${occupancy}) [Character not in the room]`;

		contents = (
			<>
				<span>Occupied by { characterDescriptor }</span>
				<WardrobeActionButton action={ {
					type: 'roomDeviceLeave',
					target: targetSelector,
					item,
					slot: slotName,
				} }>
					{ character ? 'Exit the device' : 'Clear occupancy of the slot' }
				</WardrobeActionButton>
			</>
		);
	}

	return (
		<Row padding='medium' alignY='center'>
			<span>{ slotDefinition.name }:</span>
			{ contents }
		</Row>
	);
}

export function WardrobeRoomDeviceWearable({ roomDeviceWearable }: {
	roomDeviceWearable: Item<'roomDeviceWearablePart'>;
	item: ItemPath;
}): ReactElement | null {
	const roomDeviceLink = roomDeviceWearable.roomDeviceLink;
	const { globalState } = useWardrobeActionContext();
	const roomDevice = useMemo(() => (roomDeviceLink != null
		? globalState.getItems({ type: 'roomInventory' })?.find((it) => it.id === roomDeviceLink.device)
		: undefined
	), [globalState, roomDeviceLink]);

	if (roomDeviceLink == null || roomDevice == null) {
		return (
			<FieldsetToggle legend='Slots'>
				<Column padding='medium'>
					[ERROR]
				</Column>
			</FieldsetToggle>
		);
	}

	return (
		<>
			<FieldsetToggle legend='Slots'>
				<Column padding='medium'>
					<WardrobeActionButton action={ {
						type: 'roomDeviceLeave',
						target: { type: 'roomInventory' },
						item: {
							container: [],
							itemId: roomDeviceLink.device,
						},
						slot: roomDeviceLink.slot,
					} }>
						Exit the device
					</WardrobeActionButton>
				</Column>
			</FieldsetToggle>
			<WardrobeContextSelectRoomInventoryProvider>
				{
					Array.from(roomDevice.getModules().entries())
						.map(([moduleName, m]) => (
							<FieldsetToggle legend={ `Device module: ${m.config.name}` } key={ moduleName }>
								<WardrobeModuleConfig item={ { container: [], itemId: roomDeviceLink.device } } moduleName={ moduleName } m={ m } />
							</FieldsetToggle>
						))
				}
			</WardrobeContextSelectRoomInventoryProvider>
		</>
	);
}
