import { max, min } from 'lodash-es';
import { AssertNotNullable, GenerateInitialRoomPosition, ROOM_NODE_RADIUS, SpaceRoomLayoutNeighborRoomCoordinates, type AssetFrameworkGlobalState, type AssetFrameworkRoomState, type CardinalDirection, type RoomProjectionResolver } from 'pandora-common';
import * as PIXI from 'pixi.js';
import { useCallback, useMemo, useRef, useState, type ReactElement } from 'react';
import { Color } from '../../components/common/colorInput/colorInput.tsx';
import { THEME_FONT } from '../../components/gameContext/interfaceSettingsProvider.tsx';
import { usePlayerId } from '../../components/gameContext/playerContextProvider.tsx';
import { useWardrobeExecuteCallback } from '../../components/wardrobe/wardrobeActionContext.tsx';
import { useAccountSettings } from '../../services/accountLogic/accountManagerHooks.ts';
import { Container } from '../baseComponents/container.ts';
import { Graphics } from '../baseComponents/graphics.ts';
import { PixiMesh } from '../baseComponents/mesh.tsx';
import { GenerateRectangleMeshGeometry } from '../common/generateRectangleGeometry.ts';

export interface RoomLinkNodeGraphicsProps {
	cardinalDirection: CardinalDirection;
	room: AssetFrameworkRoomState;
	globalState: AssetFrameworkGlobalState;
	projectionResolver: RoomProjectionResolver;
}

const BORDER_WIDTH = 0.1 * ROOM_NODE_RADIUS;
const ARROW_DISTANCE = 0.65;
const ARROW_WIDTH = 0.2;
const ARROW_HEIGHT = 0.3;
const TEXT_RATIO = 0.6;

function MakeDirectionTexture(direction: CardinalDirection): PIXI.Texture {
	const labelStyle = new PIXI.TextStyle({
		fontFamily: THEME_FONT.slice(),
		fontSize: 72,
		fill: 0xffffff,
		dropShadow: {
			distance: 1,
			blur: 3,
			angle: Math.PI * (135 / 180),
		},
	});
	labelStyle.padding = 4;

	const { canvasAndContext, frame } = PIXI.CanvasTextGenerator.getCanvasAndContext({
		text: direction,
		style: labelStyle,
	});

	return new PIXI.Texture({
		source: new PIXI.CanvasSource({
			resource: canvasAndContext.canvas,
			alphaMode: 'premultiply-alpha-on-upload',
		}),
		frame,
		label: `Cardinal direction letter: ${direction}`,
	});
}

const DIRECTION_LETTER_TEXTURES: Partial<Record<CardinalDirection, PIXI.Texture>> = {};

export function RoomLinkNodeGraphics({ projectionResolver, cardinalDirection, globalState, room }: RoomLinkNodeGraphicsProps): ReactElement | null {
	const {
		interfaceAccentColor,
	} = useAccountSettings();
	const [execute] = useWardrobeExecuteCallback();
	const playerId = usePlayerId();
	AssertNotNullable(playerId);

	const nodeData = room.roomLinkData[cardinalDirection];
	const [x, y] = nodeData.position;
	const z = 0;

	const neighborRoom = useMemo(() => {
		const neighborPosition = SpaceRoomLayoutNeighborRoomCoordinates(room.position, cardinalDirection);
		return globalState.space.getRoomByPosition(neighborPosition);
	}, [room.position, cardinalDirection, globalState.space]);

	const [x1, y1] = projectionResolver.fixupPosition([x - ROOM_NODE_RADIUS, y - ROOM_NODE_RADIUS, z]);
	const [x2, y2] = projectionResolver.fixupPosition([x + ROOM_NODE_RADIUS, y + ROOM_NODE_RADIUS, z]);

	const [held, setHeld] = useState(false);
	const heldRef = useRef(false);
	const [hover, setHover] = useState(false);

	const draw = useCallback((g: PIXI.GraphicsContext) => {
		// Arrow
		const arrowPrimaryX = nodeData.internalDirection === 'left' ? -1 : nodeData.internalDirection === 'right' ? 1 : 0;
		const arrowPrimaryY = nodeData.internalDirection === 'near' ? -1 : nodeData.internalDirection === 'far' ? 1 : 0;
		const arrowSecondaryX = Math.abs(arrowPrimaryY);
		const arrowSecondaryY = Math.abs(arrowPrimaryX);
		const centerX = (x1 + x2) / 2;
		const centerY = (y1 + y2) / 2;
		const halfWidth = Math.abs((x1 - x2) / 2);
		const halfHeight = Math.abs((y1 - y2) / 2);

		g
			.poly([
				...projectionResolver.transform(
					centerX + arrowPrimaryX * ARROW_DISTANCE * halfWidth + arrowSecondaryX * ARROW_HEIGHT * halfWidth,
					centerY + arrowPrimaryY * ARROW_DISTANCE * halfHeight + arrowSecondaryY * ARROW_HEIGHT * halfHeight,
					z),
				...projectionResolver.transform(
					centerX + arrowPrimaryX * ARROW_DISTANCE * halfWidth + arrowSecondaryX * (-ARROW_HEIGHT) * halfWidth,
					centerY + arrowPrimaryY * ARROW_DISTANCE * halfHeight + arrowSecondaryY * (-ARROW_HEIGHT) * halfHeight,
					z),
				...projectionResolver.transform(
					centerX + arrowPrimaryX * (ARROW_DISTANCE + ARROW_WIDTH) * halfWidth,
					centerY + arrowPrimaryY * (ARROW_DISTANCE + ARROW_WIDTH) * halfHeight,
					z),
			])
			.fill({
				color: 0xffffff,
				alpha: held ? 0.6 : 0.4,
			});

		// Border
		g
			.poly([
				...projectionResolver.transform(x1, y1, z),
				...projectionResolver.transform(x2, y1, z),
				...projectionResolver.transform(x2, y2, z),
				...projectionResolver.transform(x1, y2, z),
			])
			.fill({
				color: 0xffffff,
				alpha: held ? 0.6 : hover ? 0.4 : 0.3,
			})
			.poly([
				...projectionResolver.transform(x1 + BORDER_WIDTH, y1 + BORDER_WIDTH, z),
				...projectionResolver.transform(x2 - BORDER_WIDTH, y1 + BORDER_WIDTH, z),
				...projectionResolver.transform(x2 - BORDER_WIDTH, y2 - BORDER_WIDTH, z),
				...projectionResolver.transform(x1 + BORDER_WIDTH, y2 - BORDER_WIDTH, z),
			])
			.cut();
	}, [nodeData.internalDirection, x1, x2, y1, y2, projectionResolver, held, hover]);

	const labelGeometry = useMemo(() => {
		const textWidth = TEXT_RATIO * (x2 - x1);
		const textHeight = TEXT_RATIO * (y2 - y1);
		const textSize = Math.min(textWidth, textHeight);
		const textCenterX = (x1 + x2) / 2;
		const textCenterY = (y1 + y2) / 2;

		// v is inverted as we want to render the text top-down as far-near
		return GenerateRectangleMeshGeometry((u, v) => projectionResolver.transform(textCenterX + ((u - 0.5) * textSize), textCenterY + ((0.5 - v) * textSize), z), 2);
	}, [projectionResolver, x1, x2, y1, y2]);

	const hitArea = useMemo(() => {
		const [haX1, haY1] = projectionResolver.transform(x1, y1, z);
		const [haX2, haY2] = projectionResolver.transform(x2, y1, z);
		const [haX3, haY3] = projectionResolver.transform(x2, y2, z);
		const [haX4, haY4] = projectionResolver.transform(x1, y2, z);

		const left = min([haX1, haX2, haX3, haX4]) ?? 0;
		const right = max([haX1, haX2, haX3, haX4]) ?? 0;
		const top = min([haY1, haY2, haY3, haY4]) ?? 0;
		const bottom = max([haY1, haY2, haY3, haY4]) ?? 0;

		return new PIXI.Rectangle(left, top, right - left, bottom - top);
	}, [projectionResolver, x1, x2, y1, y2]);

	const onPointerDown = useCallback((event: PIXI.FederatedPointerEvent) => {
		if (event.button !== 1) {
			setHeld(true);
			heldRef.current = true;
			event.stopPropagation();
		}
	}, []);

	const onPointerUp = useCallback((_event: PIXI.FederatedPointerEvent) => {
		const doRun = heldRef.current;
		setHeld(false);
		heldRef.current = false;
		if (doRun && neighborRoom != null) {
			execute({
				type: 'moveCharacter',
				target: { type: 'character', characterId: playerId },
				moveTo: {
					type: 'normal',
					room: neighborRoom.id,
					position: GenerateInitialRoomPosition(neighborRoom.roomBackground),
				},
			});
		}
	}, [execute, neighborRoom, playerId]);

	const onPointerUpOutside = useCallback((_event: PIXI.FederatedPointerEvent) => {
		setHeld(false);
		heldRef.current = false;
	}, []);

	const onPointerEnter = useCallback((_event: PIXI.FederatedPointerEvent) => {
		setHover(true);
	}, []);

	const onPointerLeave = useCallback((_event: PIXI.FederatedPointerEvent) => {
		setHover(false);
	}, []);

	const tint = useMemo(() => new Color('#cccccc').mixSrgb(new Color(interfaceAccentColor), held ? 0.65 : hover ? 0.35 : 0).toHex(), [held, hover, interfaceAccentColor]);

	if (neighborRoom == null || nodeData.disabled)
		return null;

	return (
		<Container
			tint={ tint }
			hitArea={ hitArea }
			cursor='pointer'
			eventMode='static'
			onpointerdown={ onPointerDown }
			onpointerup={ onPointerUp }
			onpointerupoutside={ onPointerUpOutside }
			onpointerenter={ onPointerEnter }
			onpointerleave={ onPointerLeave }
		>
			<Graphics
				draw={ draw }
			/>
			<PixiMesh
				alpha={ held ? 0.6 : 0.4 }
				texture={ (DIRECTION_LETTER_TEXTURES[cardinalDirection] ??= MakeDirectionTexture(cardinalDirection)) }
				vertices={ labelGeometry.vertices }
				uvs={ labelGeometry.uvs }
				indices={ labelGeometry.indices }
			/>
		</Container>
	);
}
