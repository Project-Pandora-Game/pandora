import { Immutable } from 'immer';
import { throttle } from 'lodash-es';
import {
	AssertNever,
	AssetFrameworkCharacterState,
	CHARACTER_SETTINGS_DEFAULT,
	ICharacterRoomData,
	ItemRoomDevice,
	RoomDeviceDeploymentPosition,
	type AssetFrameworkRoomState,
	type RoomProjectionResolver,
} from 'pandora-common';
import * as PIXI from 'pixi.js';
import { memo, ReactElement, ReactNode, useCallback, useMemo, useRef, useState } from 'react';
import { Character } from '../../character/character.ts';
import { useEvent } from '../../common/useEvent.ts';
import { Color } from '../../components/common/colorInput/colorInput.tsx';
import { WardrobeItemName } from '../../components/wardrobe/itemDetail/wardrobeItemName.tsx';
import { useWardrobeExecuteCallback } from '../../components/wardrobe/wardrobeActionContext.tsx';
import { LIVE_UPDATE_THROTTLE } from '../../config/Environment.ts';
import { useObservable } from '../../observable.ts';
import { useAccountSettings } from '../../services/accountLogic/accountManagerHooks.ts';
import { ColoredName } from '../../ui/components/common/coloredName.tsx';
import { ROOM_CONTEXT_MENU_OFFSET, useRoomScreenContext } from '../../ui/screens/room/roomContext.tsx';
import { DeviceOverlaySetting, SettingDisplayCharacterName, useIsRoomConstructionModeEnabled } from '../../ui/screens/room/roomState.ts';
import { Container } from '../baseComponents/container.ts';
import { Graphics } from '../baseComponents/graphics.ts';
import { useDefineHitscanTarget, type HitscanTargetProps } from '../common/hitscan/hitscanTarget.tsx';
import { PointLike } from '../common/point.ts';
import { useCharacterDisplayStyle } from '../common/visionFilters.tsx';
import { MovementHelperGraphics } from '../movementHelper.tsx';
import { RoomCharacterLabel } from './roomCharacter.tsx';
import { RoomItemGraphics } from './roomItemGraphics.tsx';

const PIVOT_TO_LABEL_OFFSET = 100;
const DEVICE_WAIT_DRAG_THRESHOLD = 400; // ms

type RoomDeviceInteractiveProps = {
	characters: readonly Character<ICharacterRoomData>[];
	charactersInDevice: readonly AssetFrameworkCharacterState[];
	roomState: AssetFrameworkRoomState;
	item: ItemRoomDevice;
	deployment: Immutable<RoomDeviceDeploymentPosition>;
	projectionResolver: RoomProjectionResolver;
	filters: () => readonly PIXI.Filter[];
};

type RoomDeviceProps = {
	characters: readonly Character<ICharacterRoomData>[];
	charactersInDevice: readonly AssetFrameworkCharacterState[];
	roomState: AssetFrameworkRoomState;
	item: ItemRoomDevice;
	deployment: Immutable<RoomDeviceDeploymentPosition>;
	projectionResolver: RoomProjectionResolver;
	filters: () => readonly PIXI.Filter[];

	children?: ReactNode;
	hitArea?: PIXI.Rectangle;
	cursor?: PIXI.Cursor;
	eventMode?: PIXI.EventMode;
};

export function RoomDeviceMovementTool({
	roomState,
	item,
	deployment,
	projectionResolver,
}: Pick<RoomDeviceInteractiveProps, 'roomState' | 'item' | 'deployment' | 'projectionResolver'>): ReactElement | null {
	const asset = item.asset;

	const {
		setRoomSceneMode,
	} = useRoomScreenContext();

	const [execute] = useWardrobeExecuteCallback({ allowMultipleSimultaneousExecutions: true });

	const setPositionRaw = useCallback((newX: number, newY: number, newYOffset: number) => {
		[newX, newY, newYOffset] = projectionResolver.fixupPosition([newX, newY, newYOffset]);

		execute({
			type: 'roomDeviceDeploy',
			target: {
				type: 'room',
				roomId: roomState.id,
			},
			item: {
				container: [],
				itemId: item.id,
			},
			deployment: {
				deployed: true,
				position: {
					x: newX,
					y: newY,
					yOffset: newYOffset,
				},
			},
		});
	}, [execute, roomState.id, item.id, projectionResolver]);

	const setPositionThrottled = useMemo(() => throttle(setPositionRaw, LIVE_UPDATE_THROTTLE), [setPositionRaw]);

	const [deploymentX, deploymentY, yOffsetExtra] = projectionResolver.fixupPosition([
		deployment.x,
		deployment.y,
		deployment.yOffset,
	]);

	const [x, y] = projectionResolver.transform(deploymentX, deploymentY, 0);
	const scale = projectionResolver.scaleAt(deploymentX, deploymentY, 0);

	const pivot = useMemo<PointLike>(() => ({
		x: asset.definition.pivot.x,
		y: asset.definition.pivot.y,
	}), [asset]);

	const labelX = pivot.x;
	const labelY = pivot.y + PIVOT_TO_LABEL_OFFSET;

	const hitAreaRadius = 50;
	const hitArea = useMemo(() => new PIXI.Rectangle(-hitAreaRadius, -hitAreaRadius, 2 * hitAreaRadius, 2 * hitAreaRadius), [hitAreaRadius]);

	const roomDeviceContainer = useRef<PIXI.Container>(null);
	const dragging = useRef<PIXI.Point | null>(null);
	/** Time at which user pressed button/touched */
	const pointerDown = useRef<number | null>(null);
	const pointerDownTarget = useRef<'pos' | 'offset' | null>(null);

	const [heldPos, setHeldPos] = useState(false);
	const [hoverPos, setHoverPos] = useState(false);
	const [heldOffset, setHeldOffset] = useState(false);
	const [hoverOffset, setHoverOffset] = useState(false);

	const onDragStart = useCallback((event: PIXI.FederatedPointerEvent) => {
		if (dragging.current || !roomDeviceContainer.current?.parent) return;
		dragging.current = event.getLocalPosition<PIXI.Point>(roomDeviceContainer.current.parent);
	}, []);

	const onDragMove = useEvent((event: PIXI.FederatedPointerEvent) => {
		if (!dragging.current || !roomDeviceContainer.current?.parent) return;

		if (pointerDownTarget.current === 'pos') {
			const dragPointerEnd = event.getLocalPosition<PIXI.Point>(roomDeviceContainer.current.parent);

			const [newX, newY] = projectionResolver.inverseGivenZ(dragPointerEnd.x, dragPointerEnd.y - PIVOT_TO_LABEL_OFFSET * scale, 0);

			setPositionThrottled(newX, newY, yOffsetExtra);
		} else if (pointerDownTarget.current === 'offset') {
			const dragPointerEnd = event.getLocalPosition<PIXI.Point>(roomDeviceContainer.current);

			const newYOffset = (dragPointerEnd.y - labelY) * -scale;

			setPositionThrottled(deployment.x, deployment.y, newYOffset);
		}
	});

	const onPointerDownPos = useCallback((event: PIXI.FederatedPointerEvent) => {
		event.stopPropagation();
		setHeldPos(true);
		pointerDown.current = Date.now();
		pointerDownTarget.current = 'pos';
	}, []);
	const onPointerDownOffset = useCallback((event: PIXI.FederatedPointerEvent) => {
		event.stopPropagation();
		setHeldOffset(true);
		pointerDown.current = Date.now();
		pointerDownTarget.current = 'offset';
	}, []);

	const onPointerUp = useEvent((_event: PIXI.FederatedPointerEvent) => {
		dragging.current = null;
		if (
			pointerDown.current !== null &&
			pointerDownTarget.current != null &&
			Date.now() < pointerDown.current + DEVICE_WAIT_DRAG_THRESHOLD
		) {
			if (pointerDownTarget.current === 'pos') {
				setRoomSceneMode({ mode: 'normal' });
			} else if (pointerDownTarget.current === 'offset') {
				setPositionThrottled(deployment.x, deployment.y, 0);
			}
		}
		pointerDown.current = null;
		pointerDownTarget.current = null;
		setHeldPos(false);
		setHeldOffset(false);
	});

	const onPointerMove = useCallback((event: PIXI.FederatedPointerEvent) => {
		if (pointerDown.current !== null) {
			event.stopPropagation();
		}
		if (dragging.current) {
			onDragMove(event);
		} else if (
			pointerDown.current !== null &&
			pointerDownTarget.current != null &&
			Date.now() >= pointerDown.current + DEVICE_WAIT_DRAG_THRESHOLD
		) {
			onDragStart(event);
		}
	}, [onDragMove, onDragStart]);

	return (
		<Container
			ref={ roomDeviceContainer }
			position={ { x, y } }
			scale={ { x: scale, y: scale } }
			pivot={ pivot }
		>
			<MovementHelperGraphics
				radius={ hitAreaRadius }
				theme={ heldPos ? 'active' : hoverPos ? 'hover' : 'normal' }
				colorLeftRight={ 0xff0000 }
				colorUpDown={ 0x00ff00 }
				position={ { x: labelX, y: labelY } }
				scale={ { x: 1, y: 0.6 } }
				hitArea={ hitArea }
				eventMode='static'
				cursor='move'
				onpointerdown={ onPointerDownPos }
				onpointerup={ onPointerUp }
				onpointerupoutside={ onPointerUp }
				onglobalpointermove={ onPointerMove }
				onpointerenter={ useCallback(() => {
					setHoverPos(true);
				}, []) }
				onpointerleave={ useCallback(() => {
					setHoverPos(false);
				}, []) }
			/>
			<MovementHelperGraphics
				radius={ hitAreaRadius }
				theme={ heldOffset ? 'active' : hoverOffset ? 'hover' : 'normal' }
				colorUpDown={ 0x0000ff }
				position={ { x: labelX + 110, y: labelY - (yOffsetExtra / scale) } }
				hitArea={ hitArea }
				eventMode='static'
				cursor='ns-resize'
				onpointerdown={ onPointerDownOffset }
				onpointerup={ onPointerUp }
				onpointerupoutside={ onPointerUp }
				onglobalpointermove={ onPointerMove }
				onpointerenter={ useCallback(() => {
					setHoverOffset(true);
				}, []) }
				onpointerleave={ useCallback(() => {
					setHoverOffset(false);
				}, []) }
			/>
		</Container>
	);
}

export const RoomDeviceInteractive = memo(function RoomDeviceInteractive({
	characters,
	charactersInDevice,
	roomState,
	item,
	deployment,
	projectionResolver,
	filters,
}: RoomDeviceInteractiveProps): ReactElement | null {
	const asset = item.asset;
	const { interfaceAccentColor } = useAccountSettings();

	const {
		roomSceneMode,
		openContextMenu,
	} = useRoomScreenContext();

	const isBeingMoved = roomSceneMode.mode === 'moveDevice' && roomSceneMode.deviceItemId === item.id;

	const [deploymentX, deploymentY, yOffsetExtra] = projectionResolver.fixupPosition([item.deployment.x, item.deployment.y, item.deployment.yOffset]);

	const [x, y] = projectionResolver.transform(deploymentX, deploymentY, 0);
	const scale = useMemo((): PointLike => {
		const scaleAt = projectionResolver.scaleAt(deploymentX, deploymentY, 0);
		return { x: scaleAt, y: scaleAt };
	}, [deploymentX, deploymentY, projectionResolver]);

	const pivot = useMemo<PointLike>(() => ({
		x: asset.definition.pivot.x,
		y: asset.definition.pivot.y,
	}), [asset]);

	const position2d = useMemo((): PointLike => ({ x, y: y - yOffsetExtra }), [x, y, yOffsetExtra]);

	const labelX = pivot.x;
	const labelY = pivot.y + PIVOT_TO_LABEL_OFFSET;

	const hitAreaRadius = 50;
	const hitArea = useMemo(() => new PIXI.Rectangle(labelX - hitAreaRadius, labelY - hitAreaRadius, 2 * hitAreaRadius, 2 * hitAreaRadius), [hitAreaRadius, labelX, labelY]);

	// Overlay graphics
	const defaultView = useObservable(DeviceOverlaySetting);
	const roomConstructionMode = useIsRoomConstructionModeEnabled();
	const showOverlaySetting = roomConstructionMode ? 'always' : defaultView;

	const canInteractNormally = Object.keys(asset.definition.slots).length > 0;
	const enableMenu = !isBeingMoved && (canInteractNormally || showOverlaySetting === 'always');
	const showMenuHelper = enableMenu && (
		showOverlaySetting === 'always' ||
		(showOverlaySetting === 'interactable' && canInteractNormally)
	);

	const { held, hover } = useDefineHitscanTarget(useMemo((): HitscanTargetProps | null => {
		if (!enableMenu)
			return null;

		const roomHitArea = new PIXI.Rectangle(
			position2d.x + scale.x * (hitArea.x - pivot.x),
			position2d.y + scale.y * (hitArea.y - pivot.y),
			scale.x * hitArea.width,
			scale.y * hitArea.height,
		);

		return {
			hitArea: roomHitArea,
			stopClickPropagation: true,
			// eslint-disable-next-line react/no-unstable-nested-components
			getSelectionButtonContents() {
				return (
					<WardrobeItemName item={ item } />
				);
			},
			onClick(pos) {
				openContextMenu({
					type: 'device',
					room: roomState.id,
					deviceItemId: item.id,
					position: {
						x: pos.pageX + ROOM_CONTEXT_MENU_OFFSET.x,
						y: pos.pageY + ROOM_CONTEXT_MENU_OFFSET.y,
					},
				});
			},
		};
	}, [enableMenu, hitArea, roomState.id, item, openContextMenu, position2d, pivot, scale]));

	const deviceMenuHelperDraw = useCallback((g: PIXI.GraphicsContext) => {
		if (!showMenuHelper) {
			return;
		}

		// Draw outline if hovering or holding the button
		if (held || hover) {
			const outlineColor = new Color('#222222').mixSrgb(new Color(interfaceAccentColor), held ? 0.65 : 0.35).toHex();
			const outlineWidth = 4;
			g.circle(0, 0, hitAreaRadius + outlineWidth / 2)
				.stroke({ color: outlineColor, alpha: 1, width: outlineWidth });
		}

		g
			.circle(0, 0, hitAreaRadius)
			.fill({ color: roomConstructionMode ? 0xff0000 : 0x000075, alpha: roomConstructionMode ? 0.7 : 0.2 })
			.poly([
				-30, 10,
				5, -40,
				5, -5,
				30, -5,
				-5, 40,
				-5, 10,
			])
			.fill({ color: roomConstructionMode ? 0x000000 : 0x0000ff, alpha: roomConstructionMode ? 0.8 : 0.4 });
	}, [showMenuHelper, roomConstructionMode, hitAreaRadius, held, hover, interfaceAccentColor]);

	const showCharacterNames = useObservable(SettingDisplayCharacterName);

	return (
		<>
			<RoomDevice
				characters={ characters }
				charactersInDevice={ charactersInDevice }
				roomState={ roomState }
				item={ item }
				deployment={ deployment }
				projectionResolver={ projectionResolver }
				filters={ filters }
				hitArea={ hitArea }
				cursor={ enableMenu ? 'pointer' : 'none' }
				eventMode={ enableMenu ? 'static' : 'none' }
			>
				{
					enableMenu ? (
						<Graphics
							zIndex={ 99998 }
							draw={ deviceMenuHelperDraw }
							position={ { x: labelX, y: labelY } }
						/>
					) : null
				}
			</RoomDevice>
			{
				showCharacterNames ? (
					<RoomDeviceCharacterNames
						item={ item }
						characters={ characters }
						charactersInDevice={ charactersInDevice }
						deployment={ deployment }
						projectionResolver={ projectionResolver }
					/>
				) : null
			}
		</>
	);
});

function RoomDeviceCharacterNames({
	item,
	characters,
	charactersInDevice,
	deployment,
	projectionResolver,
}: Pick<RoomDeviceProps, 'item' | 'characters' | 'charactersInDevice' | 'deployment' | 'projectionResolver'>): ReactElement {
	const {
		interfaceChatroomCharacterNameFontSize,
	} = useAccountSettings();

	let fontScale: number;
	switch (interfaceChatroomCharacterNameFontSize) {
		case 'xs': fontScale = 0.6; break;
		case 's': fontScale = 1.0; break;
		case 'm': fontScale = 1.4; break;
		case 'l': fontScale = 1.8; break;
		case 'xl': fontScale = 2.2; break;
		default:
			AssertNever(interfaceChatroomCharacterNameFontSize);
	}

	const [deploymentX, deploymentY, yOffsetExtra] = projectionResolver.fixupPosition([
		deployment.x,
		deployment.y,
		deployment.yOffset,
	]);

	const [x, y] = projectionResolver.transform(deploymentX, deploymentY, 0);
	const scale = projectionResolver.scaleAt(deploymentX, deploymentY, 0);

	return (
		<>
			{
				useMemo(() => {
					if (characters == null)
						return null;

					const result: ReactNode[] = [];
					const spacing = 42 * fontScale;

					for (const slot of Object.keys(item.asset.definition.slots)) {
						const characterId = item.slotOccupancy.get(slot);
						const character = characterId != null ? characters.find((c) => c.id === characterId) : undefined;
						const characterState = charactersInDevice.find((c) => c.id === characterId);

						if (character == null || characterState == null)
							continue;

						// Character must be in this device, otherwise we skip the name
						// (could happen if character left and rejoined the room without device equipped)
						const roomDeviceLink = characterState.getRoomDeviceWearablePart()?.roomDeviceLink ?? null;
						if (roomDeviceLink == null || roomDeviceLink.device !== item.id || roomDeviceLink.slot !== slot)
							continue;

						result.push(<RoomDeviceCharacterName
							key={ character.id }
							character={ character }
							x={ x }
							y={ y - yOffsetExtra + scale * ((result.length + 0.5) * spacing + PIVOT_TO_LABEL_OFFSET + 85) }
							zIndex={ -deploymentY - 0.5 }
							scale={ scale }
							spacing={ spacing }
						/>);
					}

					return result;
				}, [characters, charactersInDevice, deploymentY, fontScale, item, scale, x, y, yOffsetExtra])
			}
		</>
	);
}

function RoomDeviceCharacterName({ character, x, y, zIndex, scale, spacing }: {
	character: Character;
	x: number;
	y: number;
	zIndex: number;
	scale: number;
	spacing: number;
}): ReactElement | null {
	const {
		openContextMenu,
	} = useRoomScreenContext();

	const characterDisplayStyle = useCharacterDisplayStyle(character);

	const hitArea = useMemo(() => new PIXI.Rectangle(-100, -0.5 * spacing, 200, spacing), [spacing]);

	const { held, hover } = useDefineHitscanTarget(useMemo((): HitscanTargetProps | null => {
		if (characterDisplayStyle === 'hidden')
			return null;

		const roomHitArea = new PIXI.Rectangle(
			x + scale * hitArea.x,
			y + scale * hitArea.y,
			scale * hitArea.width,
			scale * hitArea.height,
		);

		return {
			hitArea: roomHitArea,
			stopClickPropagation: true,
			// eslint-disable-next-line react/no-unstable-nested-components
			getSelectionButtonContents() {
				const { publicSettings, name, id } = character.data;

				return (
					<><ColoredName color={ publicSettings.labelColor ?? CHARACTER_SETTINGS_DEFAULT.labelColor }>{ name }</ColoredName> ({ id })</>
				);
			},
			onClick(pos) {
				openContextMenu({
					type: 'character',
					character,
					position: {
						x: pos.pageX + ROOM_CONTEXT_MENU_OFFSET.x,
						y: pos.pageY + ROOM_CONTEXT_MENU_OFFSET.y,
					},
				});
			},
		};
	}, [character, characterDisplayStyle, hitArea, openContextMenu, x, y, scale]));

	if (characterDisplayStyle === 'hidden')
		return null;

	return (
		<Container
			key={ character.id }
			position={ { x, y } }
			scale={ { x: scale, y: scale } }
			cursor='pointer'
			eventMode='static'
			hitArea={ hitArea }
			zIndex={ zIndex }
		>
			<RoomCharacterLabel
				character={ character }
				theme={ held ? 'active' : hover ? 'hover' : 'normal' }
			/>
		</Container>
	);
}

export const RoomDevice = memo(function RoomDevice({
	characters,
	charactersInDevice,
	roomState,
	item,
	deployment,
	projectionResolver,
	filters,

	children,
	hitArea,
	cursor,
	eventMode,
}: RoomDeviceProps): ReactElement | null {
	return (
		<RoomItemGraphics
			item={ item }
			position={ [deployment.x, deployment.y, deployment.yOffset] }
			roomBackground={ roomState.roomBackground }
			projectionResolver={ projectionResolver }
			charactersInDevice={ charactersInDevice }
			characters={ characters }
			filters={ filters }
			hitArea={ hitArea }
			eventMode={ eventMode }
			cursor={ cursor }
		>
			{ children }
		</RoomItemGraphics>
	);
});
