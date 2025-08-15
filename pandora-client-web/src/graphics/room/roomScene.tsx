import { Immutable } from 'immer';
import { clamp } from 'lodash-es';
import {
	Assert,
	AssertNever,
	AssertNotNullable,
	AssetFrameworkGlobalState,
	CalculateBackgroundDataFromCalibrationData,
	FilterItemType,
	ICharacterRoomData,
	ItemRoomDevice,
	RectangleSchema,
	RoomBackgroundData,
	SpaceClientInfo,
	SpaceIdSchema,
	type RoomId,
} from 'pandora-common';
import { IBounceOptions } from 'pixi-viewport';
import * as PIXI from 'pixi.js';
import { Filter, Rectangle } from 'pixi.js';
import React, { ReactElement, useCallback, useMemo, useRef } from 'react';
import { z as zod } from 'zod';
import { BrowserStorage } from '../../browserStorage.ts';
import { Character, useCharacterData, useCharacterRestrictionManager } from '../../character/character.ts';
import { CommonProps } from '../../common/reactTypes.ts';
import { useEvent } from '../../common/useEvent.ts';
import { useActionSpaceContext, useCharacterState, useGameState, useGlobalState, useSpaceCharacters, useSpaceInfo, type GameState } from '../../components/gameContext/gameStateContextProvider.tsx';
import { THEME_NORMAL_BACKGROUND } from '../../components/gameContext/interfaceSettingsProvider.tsx';
import { permissionCheckContext } from '../../components/gameContext/permissionCheckProvider.tsx';
import { usePlayer, usePlayerState } from '../../components/gameContext/playerContextProvider.tsx';
import { wardrobeActionContext } from '../../components/wardrobe/wardrobeActionContext.tsx';
import { useAccountSettings } from '../../services/accountLogic/accountManagerHooks.ts';
import { serviceManagerContext } from '../../services/serviceProvider.tsx';
import { roomScreenContext, useRoomScreenContext } from '../../ui/screens/room/roomContext.tsx';
import { ChatroomDebugConfig, useDebugConfig } from '../../ui/screens/room/roomDebug.tsx';
import { Container } from '../baseComponents/container.ts';
import { Graphics } from '../baseComponents/graphics.ts';
import { PixiViewportRef, PixiViewportSetupCallback, type PixiViewportProps } from '../baseComponents/pixiViewport.tsx';
import { GraphicsBackground } from '../graphicsBackground.tsx';
import { GraphicsScene, GraphicsSceneProps } from '../graphicsScene.tsx';
import { RoomCharacterInteractive } from './roomCharacter.tsx';
import { RoomCharacterMovementTool, RoomCharacterPosingTool } from './roomCharacterPosing.tsx';
import { RoomDeviceInteractive, RoomDeviceMovementTool } from './roomDevice.tsx';
import { useRoomViewProjection } from './roomProjection.tsx';

const BONCE_OVERFLOW = 500;
const BASE_BOUNCE_OPTIONS: IBounceOptions = {
	ease: 'easeOutQuad',
	friction: 0,
	sides: 'all',
	time: 500,
	underflow: 'center',
};

interface RoomGraphicsSceneProps extends CommonProps {
	room: RoomId;
	characters: readonly Character<ICharacterRoomData>[];
	gameState: GameState;
	globalState: AssetFrameworkGlobalState;
	info: Immutable<SpaceClientInfo>;
	debugConfig: ChatroomDebugConfig;
	onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
}

const RoomViewportLastPositionDataSchema = zod.object({
	spaceId: SpaceIdSchema.nullable(),
	roomBackgroundWidth: zod.number(),
	roomBackgroundHeight: zod.number(),
	visibleArea: RectangleSchema,
}).nullable();
const RoomViewportLastPosition = BrowserStorage.createSession('room.viewport.lastPosition', null, RoomViewportLastPositionDataSchema);

export function RoomGraphicsScene({
	id,
	className,
	children,
	room,
	characters,
	gameState,
	globalState,
	info,
	debugConfig,
	onPointerDown,
}: RoomGraphicsSceneProps): ReactElement {
	const {
		roomSceneMode,
	} = useRoomScreenContext();

	const roomState = globalState.space.getRoom(room);
	Assert(roomState != null, 'Room to display not found');
	const roomDevices = useMemo((): readonly ItemRoomDevice[] => (roomState.items.filter(FilterItemType('roomDevice')) ?? []), [roomState]);
	const roomBackground = useMemo((): Immutable<RoomBackgroundData> => {
		if (debugConfig?.enabled && debugConfig.roomScalingHelperData != null && roomState.roomBackground.graphics.type === 'image' && info.features.includes('development')) {
			return CalculateBackgroundDataFromCalibrationData(roomState.roomBackground.graphics.image, {
				...debugConfig.roomScalingHelperData,
				imageSize: roomState.roomBackground.imageSize,
			});
		}

		return roomState.roomBackground;
	}, [roomState, info, debugConfig]);
	const spaceId = globalState.space.spaceId;

	const projectionResolver = useRoomViewProjection(roomBackground);

	const borderDraw = useCallback((g: PIXI.GraphicsContext) => {
		g
			.rect(0, 0, roomBackground.imageSize[0], roomBackground.imageSize[1])
			.stroke({ width: 2, color: 0x404040, alpha: 0.4 });
	}, [roomBackground]);

	const calibrationLineDraw = useCallback((g: PIXI.GraphicsContext) => {
		const {
			transform,
			floorAreaWidthLeft,
			floorAreaWidthRight,
			floorAreaDepth,
			ceiling,
			renderedAreaWidth,
		} = projectionResolver;

		const renderedAreaWidthHalf = Math.floor(renderedAreaWidth / 2);

		g
			.poly([
				...transform(floorAreaWidthRight, 0, 0),
				...transform(-floorAreaWidthLeft, 0, 0),
				...transform(-floorAreaWidthLeft, floorAreaDepth, 0),
				...transform(floorAreaWidthRight, floorAreaDepth, 0),
			])
			.fill({ color: 0x550000, alpha: 0.8 })

			.poly([
				...transform(renderedAreaWidthHalf, 0, 0),
				...transform(-renderedAreaWidthHalf, 0, 0),
				...transform(0, Infinity, 0),
			])
			.fill({ color: 0x990000, alpha: 0.6 });

		if (ceiling > 0) {
			g
				.poly([
					...transform(floorAreaWidthRight, floorAreaDepth, 0),
					...transform(-floorAreaWidthLeft, floorAreaDepth, 0),
					...transform(-floorAreaWidthLeft, floorAreaDepth, ceiling),
					...transform(floorAreaWidthRight, floorAreaDepth, ceiling),
				])
				.fill({ color: 0xffff00, alpha: 0.4 })
				.poly([
					...transform(floorAreaWidthRight, 0, ceiling),
					...transform(-floorAreaWidthLeft, 0, ceiling),
					...transform(-floorAreaWidthLeft, floorAreaDepth, ceiling),
					...transform(floorAreaWidthRight, floorAreaDepth, ceiling),
				])
				.fill({ color: 0x000055, alpha: 0.8 });
		}
	}, [projectionResolver]);

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
		forwardContexts: [serviceManagerContext, roomScreenContext, wardrobeActionContext, permissionCheckContext],
		worldWidth: roomBackgroundWidth,
		worldHeight: roomBackgroundHeight,
		backgroundColor: Number.parseInt(THEME_NORMAL_BACKGROUND.substring(1, 7), 16),
	}), [viewportConfig, viewportOnMove, roomBackgroundWidth, roomBackgroundHeight]);

	return (
		<GraphicsScene
			id={ id }
			className={ className }
			divChildren={ children }
			onPointerDown={ onPointerDown }
			onDoubleClick={ onDoubleClick }
			sceneOptions={ sceneOptions }
		>
			<Graphics
				zIndex={ 2 }
				draw={ borderDraw }
			/>
			<Container key={ room + '-content' } zIndex={ 10 } sortableChildren>
				{
					characters.map((character) => {
						const characterState = globalState.characters.get(character.id);
						if (characterState == null ||
							characterState.position.type !== 'normal' ||
							characterState.currentRoom !== room
						) {
							return null;
						}

						return (
							<RoomCharacterInteractive
								key={ character.id }
								globalState={ globalState }
								character={ character }
								spaceInfo={ info }
								debugConfig={ debugConfig }
								projectionResolver={ projectionResolver }
							/>
						);
					})
				}
				{
					roomDevices.map((device) => (device.isDeployed() ? (
						<RoomDeviceInteractive
							key={ device.id }
							globalState={ globalState }
							roomState={ roomState }
							item={ device }
							deployment={ device.deployment }
							projectionResolver={ projectionResolver }
							gameState={ gameState }
						/>
					) : null))
				}
			</Container>
			<Container zIndex={ 20 } sortableChildren>
				{
					characters.map((character) => ((roomSceneMode.mode === 'moveCharacter' && roomSceneMode.characterId === character.id) ? (
						<RoomCharacterMovementTool
							key={ character.id }
							globalState={ globalState }
							character={ character }
							spaceInfo={ info }
							debugConfig={ debugConfig }
							projectionResolver={ projectionResolver }
						/>
					) : null))
				}
				{
					characters.map((character) => ((roomSceneMode.mode === 'poseCharacter' && roomSceneMode.characterId === character.id) ? (
						<RoomCharacterPosingTool
							key={ character.id }
							globalState={ globalState }
							character={ character }
							spaceInfo={ info }
							debugConfig={ debugConfig }
							projectionResolver={ projectionResolver }
						/>
					) : null))
				}
				{
					roomDevices.map((device) => ((roomSceneMode.mode === 'moveDevice' && roomSceneMode.deviceItemId === device.id && device.isDeployed()) ? (
						<RoomDeviceMovementTool
							key={ device.id }
							globalState={ globalState }
							roomState={ roomState }
							item={ device }
							deployment={ device.deployment }
							projectionResolver={ projectionResolver }
							gameState={ gameState }
						/>
					) : null))
				}
			</Container>
			{
				!debugConfig?.roomScalingHelper ? null : (
					<Graphics
						zIndex={ -1 }
						draw={ calibrationLineDraw }
					/>
				)
			}
			<GraphicsBackground
				key={ roomState.id + '-background' }
				zIndex={ -1000 }
				background={ roomBackground }
				backgroundFilters={ usePlayerVisionFilters(false) }
			/>
		</GraphicsScene>
	);
}

export function usePlayerVisionFilters(targetIsPlayer: boolean): Filter[] {
	const { player, globalState } = usePlayerState();
	const spaceContext = useActionSpaceContext();
	const restrictionManager = useCharacterRestrictionManager(player, globalState, spaceContext);
	const blindness = restrictionManager.getBlindness();
	const blurines = clamp(restrictionManager.getEffects().blurVision, 0, 16);

	return useMemo((): Filter[] => {
		if (targetIsPlayer)
			return [];
		const filters: Filter[] = [];

		if (blindness > 0) {
			const filter = new PIXI.ColorMatrixFilter({ resolution: 'inherit' });
			filter.brightness(1 - blindness / 10, false);
			filters.push(filter);
		}

		if (blurines > 0) {
			const log = Math.ceil(Math.log2(blurines)) || 0;
			const filter = new PIXI.BlurFilter({
				resolution: 'inherit',
				strength: blurines,
				quality: log + 1,
				kernelSize: 5 + 2 * log,
			});
			filters.push(filter);
		}

		return filters;
	}, [blindness, blurines, targetIsPlayer]);
}

export function useCharacterDisplayFilters(character: Character<ICharacterRoomData>): Filter[] {
	const {
		onlineStatus,
	} = useCharacterData(character);

	const { interfaceChatroomOfflineCharacterFilter } = useAccountSettings();

	const onlineFilters = useMemo(() => [], []);

	const offlineFilters = useMemo(() => {
		if (interfaceChatroomOfflineCharacterFilter === 'none') {
			return [];
		} else if (interfaceChatroomOfflineCharacterFilter === 'icon') {
			return [];
		} else if (interfaceChatroomOfflineCharacterFilter === 'darken') {
			const colorFilter = new PIXI.ColorMatrixFilter({ resolution: 'inherit' });
			colorFilter.brightness(0.4, true);
			return [colorFilter];
		} else if (interfaceChatroomOfflineCharacterFilter === 'ghost') {
			const colorFilter = new PIXI.ColorMatrixFilter({ resolution: 'inherit' });
			colorFilter.brightness(0.4, true);
			const alphaFilter = new PIXI.AlphaFilter({ alpha: 0.8, resolution: 'inherit' });
			return [colorFilter, alphaFilter];
		}
		AssertNever(interfaceChatroomOfflineCharacterFilter);
	}, [interfaceChatroomOfflineCharacterFilter]);

	return (onlineStatus !== 'offline') ? onlineFilters : offlineFilters;
}

export function RoomScene({ className }: {
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

	return (
		<RoomGraphicsScene
			className={ className }
			room={ playerState.currentRoom }
			characters={ characters }
			gameState={ gameState }
			globalState={ globalState }
			info={ info.config }
			debugConfig={ debugConfig }
			onPointerDown={ onPointerDown }
		/>
	);
}
