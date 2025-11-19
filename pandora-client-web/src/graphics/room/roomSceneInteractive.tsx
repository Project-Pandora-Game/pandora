import { Immutable } from 'immer';
import { clamp } from 'lodash-es';
import {
	Assert,
	AssertNotNullable,
	AssetFrameworkGlobalState,
	CalculateBackgroundDataFromCalibrationData,
	CardinalDirectionSchema,
	EMPTY_ARRAY,
	FilterItemType,
	ICharacterRoomData,
	ItemRoomDevice,
	RectangleSchema,
	RoomBackgroundData,
	RoomDescriptionSchema,
	RoomIdSchema,
	SpaceClientInfo,
	SpaceIdSchema,
	type AssetFrameworkCharacterState,
	type AssetFrameworkRoomState,
	type ItemId,
} from 'pandora-common';
import { IBounceOptions } from 'pixi-viewport';
import * as PIXI from 'pixi.js';
import { Rectangle } from 'pixi.js';
import React, { ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as zod from 'zod';
import { BrowserStorage } from '../../browserStorage.ts';
import { Character } from '../../character/character.ts';
import { useEvent } from '../../common/useEvent.ts';
import { Button } from '../../components/common/button/button.tsx';
import { Column } from '../../components/common/container/container.tsx';
import { useCharacterState, useGameState, useGlobalState, useSpaceCharacters, useSpaceInfo, type GameState } from '../../components/gameContext/gameStateContextProvider.tsx';
import { THEME_NORMAL_BACKGROUND } from '../../components/gameContext/interfaceSettingsProvider.tsx';
import { permissionCheckContext } from '../../components/gameContext/permissionCheckProvider.tsx';
import { usePlayer, usePlayerRestrictionManager } from '../../components/gameContext/playerContextProvider.tsx';
import { wardrobeActionContext } from '../../components/wardrobe/wardrobeActionContext.tsx';
import { useObservable } from '../../observable.ts';
import { serviceManagerContext } from '../../services/serviceProvider.tsx';
import { roomScreenContext, useRoomScreenContext } from '../../ui/screens/room/roomContext.tsx';
import { ChatroomDebugConfig, useDebugConfig } from '../../ui/screens/room/roomDebug.tsx';
import { Container } from '../baseComponents/container.ts';
import { Graphics } from '../baseComponents/graphics.ts';
import { PixiViewportRef, PixiViewportSetupCallback, type PixiViewportProps } from '../baseComponents/pixiViewport.tsx';
import { usePlayerVisionFilters, usePlayerVisionFiltersFactory } from '../common/visionFilters.tsx';
import { GraphicsBackground } from '../graphicsBackground.tsx';
import { GraphicsScene, GraphicsSceneProps } from '../graphicsScene.tsx';
import { UseTextureGetterOverride } from '../useTexture.ts';
import { RoomCharacterInteractive } from './roomCharacter.tsx';
import { RoomCharacterMovementTool, RoomCharacterPosingTool } from './roomCharacterPosing.tsx';
import { RoomDeviceInteractive, RoomDeviceMovementTool } from './roomDevice.tsx';
import { RoomLinkNodeGraphics } from './roomLinkNodeGraphics.tsx';
import { useRoomViewProjection } from './roomProjection.tsx';
import { useAccountSettings } from '../../services/accountLogic/accountManagerHooks.ts';

const BONCE_OVERFLOW = 500;
const BASE_BOUNCE_OPTIONS: IBounceOptions = {
	ease: 'easeOutQuad',
	friction: 0,
	sides: 'all',
	time: 500,
	underflow: 'center',
};

const RoomViewportLastPositionDataSchema = zod.object({
	spaceId: SpaceIdSchema.nullable(),
	roomBackgroundWidth: zod.number(),
	roomBackgroundHeight: zod.number(),
	visibleArea: RectangleSchema,
}).nullable();
const RoomViewportLastPosition = BrowserStorage.createSession('room.viewport.lastPosition', null, RoomViewportLastPositionDataSchema);

interface RoomGraphicsInteractiveProps {
	room: AssetFrameworkRoomState;
	characters: readonly Character<ICharacterRoomData>[];
	gameState: GameState;
	globalState: AssetFrameworkGlobalState;
	info: Immutable<SpaceClientInfo>;
	debugConfig: ChatroomDebugConfig;
}

export function RoomGraphicsInteractive({
	room,
	characters,
	globalState,
	info,
	debugConfig,
}: RoomGraphicsInteractiveProps): ReactElement {
	const {
		roomSceneMode,
	} = useRoomScreenContext();

	const roomDevices = useMemo((): readonly ItemRoomDevice[] => (room.items.filter(FilterItemType('roomDevice')) ?? []), [room]);
	// Optimize for the fact, that vast majority of room devices do not have a character
	const roomDeviceCharacters = useMemo((): ReadonlyMap<ItemId, readonly AssetFrameworkCharacterState[]> => {
		const result = new Map<ItemId, AssetFrameworkCharacterState[]>();
		for (const character of globalState.characters.values()) {
			const link = character.getRoomDeviceWearablePart()?.roomDeviceLink;
			if (link != null) {
				let deviceResult = result.get(link.device);
				if (deviceResult === undefined) {
					result.set(link.device, (deviceResult = []));
				}
				deviceResult.push(character);
			}
		}
		return result;
	}, [globalState]);

	const roomBackground = useMemo((): Immutable<RoomBackgroundData> => {
		if (debugConfig?.enabled && debugConfig.roomScalingHelperData != null && room.roomBackground.graphics.type === 'image' && info.features.includes('development')) {
			return CalculateBackgroundDataFromCalibrationData(room.roomBackground.graphics.image, {
				...debugConfig.roomScalingHelperData,
				imageSize: room.roomBackground.imageSize,
			});
		}

		return room.roomBackground;
	}, [room, info, debugConfig]);

	const projectionResolver = useRoomViewProjection(roomBackground);
	const playerVisionFilters = usePlayerVisionFiltersFactory(false);
	const playerSelfVisionFilters = usePlayerVisionFiltersFactory(true);

	const borderDraw = useCallback((g: PIXI.GraphicsContext) => {
		g
			.rect(0, 0, roomBackground.imageSize[0], roomBackground.imageSize[1])
			.stroke({ width: 2, color: 0x404040, alpha: 0.4 });
	}, [roomBackground]);

	const calibrationLineDraw = useCallback((g: PIXI.GraphicsContext) => {
		const {
			floorAreaWidthLeft,
			floorAreaWidthRight,
			floorAreaDepth,
			ceiling,
			renderedAreaWidth,
		} = projectionResolver;

		const renderedAreaWidthHalf = Math.floor(renderedAreaWidth / 2);

		g
			.poly([
				...projectionResolver.transform(floorAreaWidthRight, 0, 0),
				...projectionResolver.transform(-floorAreaWidthLeft, 0, 0),
				...projectionResolver.transform(-floorAreaWidthLeft, floorAreaDepth, 0),
				...projectionResolver.transform(floorAreaWidthRight, floorAreaDepth, 0),
			])
			.fill({ color: 0x550000, alpha: 0.8 })

			.poly([
				...projectionResolver.transform(renderedAreaWidthHalf, 0, 0),
				...projectionResolver.transform(-renderedAreaWidthHalf, 0, 0),
				...projectionResolver.transform(0, Infinity, 0),
			])
			.fill({ color: 0x990000, alpha: 0.6 });

		if (ceiling > 0) {
			g
				.poly([
					...projectionResolver.transform(floorAreaWidthRight, floorAreaDepth, 0),
					...projectionResolver.transform(-floorAreaWidthLeft, floorAreaDepth, 0),
					...projectionResolver.transform(-floorAreaWidthLeft, floorAreaDepth, ceiling),
					...projectionResolver.transform(floorAreaWidthRight, floorAreaDepth, ceiling),
				])
				.fill({ color: 0xffff00, alpha: 0.4 })
				.poly([
					...projectionResolver.transform(floorAreaWidthRight, 0, ceiling),
					...projectionResolver.transform(-floorAreaWidthLeft, 0, ceiling),
					...projectionResolver.transform(-floorAreaWidthLeft, floorAreaDepth, ceiling),
					...projectionResolver.transform(floorAreaWidthRight, floorAreaDepth, ceiling),
				])
				.fill({ color: 0x000055, alpha: 0.8 });
		}
	}, [projectionResolver]);

	return (
		<Container key={ room.id }>
			<GraphicsBackground
				background={ roomBackground }
				backgroundFilters={ usePlayerVisionFilters(false) }
			/>
			{
				!debugConfig?.roomScalingHelper ? null : (
					<Graphics
						draw={ calibrationLineDraw }
					/>
				)
			}
			<Graphics
				draw={ borderDraw }
			/>
			{ CardinalDirectionSchema.options.map((direction) => (
				<RoomLinkNodeGraphics
					key={ direction }
					cardinalDirection={ direction }
					room={ room }
					globalState={ globalState }
					projectionResolver={ projectionResolver }
				/>
			)) }
			<Container sortableChildren>
				{
					characters.map((character) => {
						const characterState = globalState.characters.get(character.id);
						if (characterState == null ||
							characterState.position.type !== 'normal' ||
							characterState.currentRoom !== room.id
						) {
							return null;
						}

						return (
							<RoomCharacterInteractive
								key={ character.id }
								characterState={ characterState }
								character={ character }
								spaceInfo={ info }
								debugConfig={ debugConfig }
								projectionResolver={ projectionResolver }
								visionFilters={ character.isPlayer() ? playerSelfVisionFilters : playerVisionFilters }
							/>
						);
					})
				}
				{
					roomDevices.map((device) => (device.isDeployed() ? (
						<RoomDeviceInteractive
							key={ device.id }
							characters={ characters }
							charactersInDevice={ roomDeviceCharacters.get(device.id) ?? EMPTY_ARRAY }
							roomState={ room }
							item={ device }
							deployment={ device.deployment }
							projectionResolver={ projectionResolver }
							filters={ playerVisionFilters }
						/>
					) : null))
				}
			</Container>
			<Container sortableChildren>
				{
					characters.map((character) => {
						const characterState = globalState.characters.get(character.id);
						if (characterState == null)
							return null;

						if (roomSceneMode.mode === 'moveCharacter' && roomSceneMode.characterId === character.id) {
							return (
								<RoomCharacterMovementTool
									key={ character.id }
									characterState={ characterState }
									character={ character }
									spaceInfo={ info }
									debugConfig={ debugConfig }
									projectionResolver={ projectionResolver }
									visionFilters={ character.isPlayer() ? playerSelfVisionFilters : playerVisionFilters }
								/>
							);
						} else if (roomSceneMode.mode === 'poseCharacter' && roomSceneMode.characterId === character.id) {
							return (
								<RoomCharacterPosingTool
									key={ character.id }
									characterState={ characterState }
									character={ character }
									spaceInfo={ info }
									debugConfig={ debugConfig }
									projectionResolver={ projectionResolver }
									visionFilters={ character.isPlayer() ? playerSelfVisionFilters : playerVisionFilters }
								/>
							);
						}

						return null;
					})
				}
				{
					roomDevices.map((device) => ((roomSceneMode.mode === 'moveDevice' && roomSceneMode.deviceItemId === device.id && device.isDeployed()) ? (
						<RoomDeviceMovementTool
							key={ device.id }
							roomState={ room }
							item={ device }
							deployment={ device.deployment }
							projectionResolver={ projectionResolver }
						/>
					) : null))
				}
			</Container>
		</Container>
	);
}

export function RoomSceneInteractive({ className }: {
	className?: string;
}): ReactElement {
	const gameState = useGameState();
	const info = useSpaceInfo();
	const characters = useSpaceCharacters();

	const {
		contextMenuFocus,
		openContextMenu,
	} = useRoomScreenContext();

	const player = usePlayer();
	const debugConfig = useDebugConfig();

	const globalState = useGlobalState(gameState);

	AssertNotNullable(characters);
	AssertNotNullable(player);

	const playerState = useCharacterState(globalState, player.id);
	AssertNotNullable(playerState);

	const onPointerDown = useEvent((event: React.PointerEvent<HTMLDivElement>) => {
		if (contextMenuFocus != null) {
			openContextMenu(null, null);
			event.stopPropagation();
			event.preventDefault();
		}
	});

	const roomState = globalState.space.getRoom(playerState.currentRoom);
	Assert(roomState != null, 'Room to display not found');

	const spaceId = globalState.space.spaceId;
	const roomBackground = useMemo((): Immutable<RoomBackgroundData> => {
		if (debugConfig?.enabled && debugConfig.roomScalingHelperData != null && roomState.roomBackground.graphics.type === 'image' && info.config.features.includes('development')) {
			return CalculateBackgroundDataFromCalibrationData(roomState.roomBackground.graphics.image, {
				...debugConfig.roomScalingHelperData,
				imageSize: roomState.roomBackground.imageSize,
			});
		}

		return roomState.roomBackground;
	}, [roomState, info.config, debugConfig]);

	const [roomBackgroundWidth, roomBackgroundHeight] = roomBackground.imageSize;

	const viewportConfig = useCallback<PixiViewportSetupCallback>((viewport) => {
		viewport
			.drag({ clampWheel: true })
			.wheel({ smooth: 10, percent: 0.1 })
			.bounce({
				...BASE_BOUNCE_OPTIONS,
				bounceBox: new Rectangle(-BONCE_OVERFLOW, -BONCE_OVERFLOW, roomBackgroundWidth + 2 * BONCE_OVERFLOW, roomBackgroundHeight + 2 * BONCE_OVERFLOW),
			});

		const lastState = RoomViewportLastPosition.value;
		if (lastState != null && lastState.spaceId === spaceId && lastState.roomBackgroundHeight === roomBackgroundHeight && lastState.roomBackgroundWidth === roomBackgroundWidth) {
			viewport.fit(false, lastState.visibleArea.width, lastState.visibleArea.height);
			viewport.moveCenter(lastState.visibleArea.x + lastState.visibleArea.width / 2, lastState.visibleArea.y + lastState.visibleArea.height / 2);
		} else {
			RoomViewportLastPosition.value = null;
		}
	}, [roomBackgroundWidth, roomBackgroundHeight, spaceId]);

	const viewportOnMove = useCallback<PixiViewportProps['onMove'] & {}>((viewport) => {
		RoomViewportLastPosition.value = {
			spaceId,
			roomBackgroundWidth: viewport.worldWidth,
			roomBackgroundHeight: viewport.worldHeight,
			visibleArea: {
				x: clamp(viewport.corner.x, 0, viewport.worldWidth),
				y: clamp(viewport.corner.y, 0, viewport.worldHeight),
				width: clamp(viewport.screenWidth / viewport.scale.x, 1, viewport.worldWidth),
				height: clamp(viewport.screenHeight / viewport.scale.y, 1, viewport.worldHeight),
			},
		};
	}, [spaceId]);

	const viewportRef = useRef<PixiViewportRef>(null);

	const onDoubleClick = useEvent((event: React.PointerEvent<HTMLDivElement>) => {
		const viewport = viewportRef.current?.viewport;
		if (viewport == null)
			return;

		const outerZoomScale = viewport.findFit(viewport.worldWidth, viewport.worldHeight);

		if (Math.abs(Math.max(viewport.scale.x, viewport.scale.y) - outerZoomScale) > Number.EPSILON) {
			viewportRef.current?.center();
			event.stopPropagation();
			event.preventDefault();
		} else {
			viewportRef.current?.fitCover();
			event.stopPropagation();
			event.preventDefault();
		}
	});

	const sceneOptions = useMemo((): GraphicsSceneProps => ({
		viewportConfig,
		viewportRef,
		viewportOnMove,
		forwardContexts: [serviceManagerContext, UseTextureGetterOverride, roomScreenContext, wardrobeActionContext, permissionCheckContext],
		worldWidth: roomBackgroundWidth,
		worldHeight: roomBackgroundHeight,
		backgroundColor: Number.parseInt(THEME_NORMAL_BACKGROUND.substring(1, 7), 16),
	}), [viewportConfig, viewportOnMove, roomBackgroundWidth, roomBackgroundHeight]);

	return (
		<GraphicsScene
			className={ className }
			onPointerDown={ onPointerDown }
			onDoubleClick={ onDoubleClick }
			sceneOptions={ sceneOptions }
			divChildren={
				<RoomSceneDescriptionOverlay room={ roomState } globalState={ globalState } />
			}
		>
			<RoomGraphicsInteractive
				room={ roomState }
				characters={ characters }
				gameState={ gameState }
				globalState={ globalState }
				info={ info.config }
				debugConfig={ debugConfig }
			/>
		</GraphicsScene>
	);
}

const RoomDescriptionHidden = BrowserStorage.createSession('room.viewport.hidden-room-descriptions', {}, zod.record(RoomIdSchema, zod.object({ description: RoomDescriptionSchema, hide: zod.boolean() })));

function RoomSceneDescriptionOverlay({ room, globalState }: {
	room: AssetFrameworkRoomState;
	globalState: AssetFrameworkGlobalState;
}): ReactElement | null {
	const roomDescriptionHidden = useObservable(RoomDescriptionHidden);
	const playerRestrictionManager = usePlayerRestrictionManager();
	const { interfaceChatroomHideRoomDescriptionsRole } = useAccountSettings();

	const open = useMemo(() => {
		// Remove closed entries where description changed
		if (Object.entries(roomDescriptionHidden).some(([roomId, hidingData]) => !globalState.space.rooms.some((r) => r.id === roomId && (r.description === hidingData.description || !hidingData.hide)))) {
			RoomDescriptionHidden.produceImmer((d) => {
				for (const [roomId, hidingData] of Object.entries(d)) {
					if (!hidingData.hide)
						continue;

					if (!globalState.space.rooms.some((r) => r.id === roomId && r.description === hidingData.description)) {
						delete d[roomId as keyof typeof d];
					}
				}
			});
		}

		const data = (Object.hasOwn(roomDescriptionHidden, room.id) && roomDescriptionHidden[room.id]?.description === room.description) ? roomDescriptionHidden[room.id] : undefined;

		return !!room.description && !(data?.hide ?? playerRestrictionManager.hasSpaceRole(interfaceChatroomHideRoomDescriptionsRole));
	}, [globalState.space.rooms, interfaceChatroomHideRoomDescriptionsRole, playerRestrictionManager, room.description, room.id, roomDescriptionHidden]);

	const [hideName, setHideName] = useState(false);

	useEffect(() => {
		setHideName(false);

		let timeout: number | undefined;
		if (!open) {
			timeout = setTimeout(() => {
				if (timeout !== undefined) {
					setHideName(true);
				}
			}, 10_000);
		}

		return () => {
			if (timeout !== undefined) {
				clearTimeout(timeout);
				timeout = undefined;
			}
		};
	}, [open, room.id, room.description]);

	// Do not display if the room has no name nor description
	if (!room.name && !room.description)
		return null;

	// Do not display in single-room spaces, if the room has no description
	if (globalState.space.rooms.length === 1 && !room.description)
		return null;

	return (
		<Column className='RoomSceneDescriptionOverlayContainer' alignX='center' padding='medium'>
			<Button
				key={ room.id }
				className={ `RoomSceneDescriptionOverlay slim ${open ? 'open' : 'closed'} ${ (!open && hideName) ? 'hideName ' : '' }normalDisabled` }
				theme='semiTransparent'
				onPointerDown={ (ev) => {
					ev.stopPropagation();
				} }
				onPointerUp={ (ev) => {
					ev.stopPropagation();
				} }
				onDoubleClick={ (ev) => {
					ev.stopPropagation();
				} }
				onClick={ (ev) => {
					ev.stopPropagation();

					RoomDescriptionHidden.produceImmer((d) => {
						d[room.id] = {
							description: room.description,
							hide: open,
						};
					});
				} }
				disabled={ !open && !room.description }
				inert={ !open && hideName }
			>
				<div className='name'>{ room.displayName }</div>
				{ room.description ? (
					<div className='description'>
						{ room.description }
					</div>
				) : null }
			</Button>
		</Column>
	);
}
