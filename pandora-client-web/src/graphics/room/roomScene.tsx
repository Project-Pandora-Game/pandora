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
	RoomBackgroundData,
	SpaceClientInfo,
} from 'pandora-common';
import { IBounceOptions } from 'pixi-viewport';
import * as PIXI from 'pixi.js';
import { Filter, Rectangle } from 'pixi.js';
import React, { ReactElement, useCallback, useMemo, useRef } from 'react';
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
import { PixiViewportRef, PixiViewportSetupCallback } from '../baseComponents/pixiViewport.tsx';
import { GraphicsBackground, GraphicsScene, GraphicsSceneProps } from '../graphicsScene.tsx';
import { RoomCharacterInteractive } from './roomCharacter.tsx';
import { RoomCharacterMovementTool, RoomCharacterPosingTool } from './roomCharacterPosing.tsx';
import { RoomDeviceInteractive, RoomDeviceMovementTool } from './roomDevice.tsx';

const BONCE_OVERFLOW = 500;
const BASE_BOUNCE_OPTIONS: IBounceOptions = {
	ease: 'easeOutQuad',
	friction: 0,
	sides: 'all',
	time: 500,
	underflow: 'center',
};

interface RoomGraphicsSceneProps extends CommonProps {
	characters: readonly Character<ICharacterRoomData>[];
	gameState: GameState;
	globalState: AssetFrameworkGlobalState;
	info: Immutable<SpaceClientInfo>;
	debugConfig: ChatroomDebugConfig;
	onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
}

export function RoomGraphicsScene({
	id,
	className,
	children,
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

	const roomState = globalState.room;
	const roomDevices = useMemo((): readonly ItemRoomDevice[] => (roomState?.items.filter(FilterItemType('roomDevice')) ?? []), [roomState]);
	const roomBackground = useMemo((): Immutable<RoomBackgroundData> => {
		if (debugConfig?.enabled && debugConfig.roomScalingHelperData != null && roomState.roomBackground.graphics.type === 'image' && info.features.includes('development')) {
			return CalculateBackgroundDataFromCalibrationData(roomState.roomBackground.graphics.image, {
				...debugConfig.roomScalingHelperData,
				imageSize: roomState.roomBackground.imageSize,
			});
		}

		return roomState.roomBackground;
	}, [roomState, info, debugConfig]);

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
	}, [roomBackgroundWidth, roomBackgroundHeight]);

	const viewportRef = useRef<PixiViewportRef>(null);

	let reset = false;

	const onDoubleClick = useEvent((event: React.PointerEvent<HTMLDivElement>) => {
		if (reset) {
			reset = !reset;
			viewportRef.current?.center(),
			event.stopPropagation();
			event.preventDefault();
		} else {
			reset = !reset;
			viewportRef.current?.fit(),
			event.stopPropagation();
			event.preventDefault();
		}
	});

	const sceneOptions = useMemo((): GraphicsSceneProps => ({
		viewportConfig,
		viewportRef,
		forwardContexts: [serviceManagerContext, roomScreenContext, wardrobeActionContext, permissionCheckContext],
		worldWidth: roomBackgroundWidth,
		worldHeight: roomBackgroundHeight,
		backgroundColor: Number.parseInt(THEME_NORMAL_BACKGROUND.substring(1, 7), 16),
	}), [viewportConfig, roomBackgroundWidth, roomBackgroundHeight]);

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
			<Container zIndex={ 10 } sortableChildren>
				{
					characters.map((character) => (
						<RoomCharacterInteractive
							key={ character.id }
							globalState={ globalState }
							character={ character }
							spaceInfo={ info }
							debugConfig={ debugConfig }
							projectionResolver={ projectionResolver }
						/>
					))
				}
				{
					roomDevices.map((device) => (device.isDeployed() ? (
						<RoomDeviceInteractive
							key={ device.id }
							globalState={ globalState }
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
				zIndex={ -1000 }
				background={ roomBackground }
				backgroundFilters={ usePlayerVisionFilters(false) }
			/>
		</GraphicsScene>
	);
}

export interface RoomProjectionResolver {
	/**
	 * Gets an on-screen position a point on the given coordinates in the world should be rendered to.
	 */
	transform(x: number, y: number, z: number): [x: number, y: number];
	/**
	 * Gets a scale that should be applied to a point on the given coordinates. Accounts for base scale as well.
	 */
	scaleAt(x: number, y: number, z: number): number;
	/**
	 * Gets the 3D coordinates from on-screen coordinates, if Z coordinate (height) is already known
	 * @param resX - The on-screen X coordinate
	 * @param resY - The on-screen Y coordinate
	 * @param z - The target height
	 * @param ignoreFloorBounds - If normal floor bounds should be ignored
	 * (allows arbitrary values for x and y that match closest, otherwise it selects closest values still within bounds)
	 * Default: `false`
	 */
	inverseGivenZ(resX: number, resY: number, z: number, ignoreFloorBounds?: boolean): [x: number, y: number, z: number];
	/**
	 * Takes a position and returns the closest valid position
	 */
	fixupPosition(position: readonly [x: number, y: number, z: number]): [x: number, y: number, z: number];
	imageAspectRatio: number;
	floorAreaWidthLeft: number;
	floorAreaWidthRight: number;
	floorAreaDepth: number;
	ceiling: number;
	renderedAreaWidth: number;
	renderedAreaHeight: number;
}

export function useRoomViewProjection(roomBackground: Immutable<RoomBackgroundData>): Immutable<RoomProjectionResolver> {
	return useMemo((): Immutable<RoomProjectionResolver> => {
		const {
			imageSize,
			cameraCenterOffset,
			ceiling,
			areaCoverage,
			cameraFov,
			floorArea,
		} = roomBackground;

		const imageAspectRatio = imageSize[0] / imageSize[1];

		const floorAreaWidth = floorArea[0];
		const floorAreaWidthHalf = Math.floor(floorArea[0] / 2);
		const floorAreaDepth = floorArea[1];

		const renderedAreaWidth = floorAreaWidth / areaCoverage;
		const renderedAreaHeight = renderedAreaWidth / imageAspectRatio;
		const renderedAreaScale = imageSize[0] / renderedAreaWidth;

		const cameraSkewX = cameraCenterOffset[0] / imageSize[0];
		const cameraSkewY = cameraCenterOffset[1] / imageSize[1];

		const areaCameraPositionX = cameraSkewX * renderedAreaWidth;
		const areaCameraPositionZ = (0.5 + cameraSkewY) * renderedAreaHeight;

		const frustumNearDistance = (0.5 * renderedAreaHeight) / Math.tan(cameraFov * 0.5 * PIXI.DEG_TO_RAD);

		const transform = (x: number, y: number, z: number): [x: number, y: number] => {
			const scale = frustumNearDistance / (y + frustumNearDistance);

			return [
				imageSize[0] * (0.5 + cameraSkewX + scale * (x - areaCameraPositionX) / renderedAreaWidth),
				imageSize[1] * (0.5 - cameraSkewY - scale * (z - areaCameraPositionZ) / renderedAreaHeight),
			];
		};

		const scaleAt = (_x: number, y: number, _z: number): number => {
			return renderedAreaScale * (frustumNearDistance / (y + frustumNearDistance));
		};

		const horizonY = transform(NaN, Infinity, 0)[1];
		Assert(!Number.isNaN(horizonY));
		const maxFloorY = transform(NaN, floorAreaDepth, 0)[1];
		Assert(!Number.isNaN(maxFloorY));

		const inverseGivenZ = (resX: number, resY: number, z: number, ignoreFloorBounds: boolean = false): [x: number, y: number, z: number] => {
			// Clamp input to the viewport
			resX = clamp(resX, 0, imageSize[0]);
			// Remember, that Y increases from the bottom, and we need `scale` to be strictly bigger than zero (doesn't matter how small)
			resY = clamp(resY, horizonY + 1, imageSize[1]);

			// If the floor bounds are not ignored, limit the values further to match floor
			if (!ignoreFloorBounds) {
				resY = clamp(resY, maxFloorY, imageSize[1]);
			}

			const scale = (0.5 - cameraSkewY - (resY / imageSize[1])) * renderedAreaHeight / (z - areaCameraPositionZ);
			const x = ((-0.5 - cameraSkewX + (resX / imageSize[0])) * renderedAreaWidth / scale) + areaCameraPositionX;
			const y = (frustumNearDistance / scale) - frustumNearDistance;

			// Clamp the output coordinates to the floor area
			if (!ignoreFloorBounds) {
				return [
					clamp(x, -floorAreaWidthHalf, floorAreaWidthHalf),
					clamp(y, 0, floorAreaDepth),
					z,
				];
			}

			return [x, y, z];
		};

		const fixupPosition = ([x, y, z]: readonly [x: number, y: number, z: number]): [x: number, y: number, z: number] => {
			const minX = -floorAreaWidthHalf;
			const maxX = floorAreaWidthHalf;
			const minY = 0;
			const maxY = roomBackground.floorArea[1];

			return [
				clamp(Math.round(x), minX, maxX),
				clamp(Math.round(y), minY, maxY),
				Math.round(z),
			];
		};

		return {
			transform,
			scaleAt,
			inverseGivenZ,
			fixupPosition,
			imageAspectRatio,
			floorAreaWidthLeft: floorAreaWidthHalf,
			floorAreaWidthRight: floorAreaWidthHalf,
			floorAreaDepth,
			ceiling,
			renderedAreaWidth,
			renderedAreaHeight,
		};
	}, [roomBackground]);
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
		isOnline,
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

	return isOnline ? onlineFilters : offlineFilters;
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
			characters={ characters }
			gameState={ gameState }
			globalState={ globalState }
			info={ info.config }
			debugConfig={ debugConfig }
			onPointerDown={ onPointerDown }
		/>
	);
}
