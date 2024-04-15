import { Container, Graphics } from '@pixi/react';
import { Immutable } from 'immer';
import { clamp } from 'lodash';
import {
	Assert,
	AssertNever,
	AssertNotNullable,
	AssetFrameworkGlobalState,
	CalculateBackgroundDataFromCalibrationData,
	FilterItemType,
	ICharacterRoomData,
	ItemId,
	ItemRoomDevice,
	ResolveBackground,
	RoomBackgroundData,
	SpaceClientInfo,
} from 'pandora-common';
import { IBounceOptions } from 'pixi-viewport';
import * as PIXI from 'pixi.js';
import { FederatedPointerEvent, Filter, Rectangle } from 'pixi.js';
import React, { ReactElement, useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useAssetManager } from '../../assets/assetManager';
import { Character, useCharacterData } from '../../character/character';
import { CommonProps } from '../../common/reactTypes';
import { useEvent } from '../../common/useEvent';
import { directoryConnectorContext, useAccountSettings } from '../../components/gameContext/directoryConnectorContextProvider';
import { useCharacterRestrictionsManager, useCharacterState, useGameState, useGlobalState, useSpaceCharacters, useSpaceInfo } from '../../components/gameContext/gameStateContextProvider';
import { usePlayer, usePlayerState } from '../../components/gameContext/playerContextProvider';
import { shardConnectorContext, useShardConnector } from '../../components/gameContext/shardConnectorContextProvider';
import { ShardConnector } from '../../networking/shardConnector';
import { ChatroomDebugConfig, useDebugConfig } from '../../ui/screens/room/roomDebug';
import { PointLike } from '../graphicsCharacter';
import { GraphicsBackground, GraphicsScene, GraphicsSceneProps } from '../graphicsScene';
import { PixiViewportSetupCallback, PixiViewportRef } from '../pixiViewport';
import { CharacterContextMenu } from './contextMenus/characterContextMenu';
import { DeviceContextMenu } from './contextMenus/deviceContextMenu';
import { RoomCharacterInteractive } from './roomCharacter';
import { RoomDeviceInteractive, RoomDeviceMovementTool, useIsRoomConstructionModeEnabled } from './roomDevice';

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
	shard: ShardConnector | null;
	globalState: AssetFrameworkGlobalState;
	info: Immutable<SpaceClientInfo>;
	debugConfig: ChatroomDebugConfig;
	roomSceneMode: Immutable<IRoomSceneMode>;
	setRoomSceneMode: (newMode: Immutable<IRoomSceneMode>) => void;
	onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
	menuOpen: (target: Character<ICharacterRoomData> | ItemRoomDevice, event: FederatedPointerEvent) => void;
}

export function RoomGraphicsScene({
	id,
	className,
	children,
	characters,
	shard,
	globalState,
	info,
	debugConfig,
	roomSceneMode,
	setRoomSceneMode,
	onPointerDown,
	menuOpen,
}: RoomGraphicsSceneProps): ReactElement {
	const assetManager = useAssetManager();

	const roomState = globalState.room;
	const roomDevices = useMemo((): readonly ItemRoomDevice[] => (roomState?.items.filter(FilterItemType('roomDevice')) ?? []), [roomState]);
	const roomBackground = useMemo((): Immutable<RoomBackgroundData> => {
		const resolved = ResolveBackground(assetManager, info.background);

		if (debugConfig?.enabled && debugConfig.roomScalingHelperData != null && info.features.includes('development')) {
			return CalculateBackgroundDataFromCalibrationData(resolved.image, {
				...debugConfig.roomScalingHelperData,
				imageSize: resolved.imageSize,
			});
		}

		return resolved;
	}, [assetManager, info, debugConfig]);

	const projectionResolver = useRoomViewProjection(roomBackground);

	const borderDraw = useCallback((g: PIXI.Graphics) => {
		g.clear()
			.lineStyle(2, 0x404040, 0.4)
			.drawRect(0, 0, roomBackground.imageSize[0], roomBackground.imageSize[1]);
	}, [roomBackground]);

	const calibrationLineDraw = useCallback((g: PIXI.Graphics) => {
		const {
			transform,
			floorAreaWidthLeft,
			floorAreaWidthRight,
			floorAreaDepth,
			ceiling,
			renderedAreaWidth,
		} = projectionResolver;

		const renderedAreaWidthHalf = Math.floor(renderedAreaWidth / 2);

		g.clear()
			.beginFill(0x550000, 0.8)
			.drawPolygon([
				...transform(floorAreaWidthRight, 0, 0),
				...transform(-floorAreaWidthLeft, 0, 0),
				...transform(-floorAreaWidthLeft, floorAreaDepth, 0),
				...transform(floorAreaWidthRight, floorAreaDepth, 0),
			])
			.beginFill(0x990000, 0.6)
			.drawPolygon([
				...transform(renderedAreaWidthHalf, 0, 0),
				...transform(-renderedAreaWidthHalf, 0, 0),
				...transform(0, Infinity, 0),
			]);

		if (ceiling > 0) {
			g
				.beginFill(0xffff00, 0.4)
				.drawPolygon([
					...transform(floorAreaWidthRight, floorAreaDepth, 0),
					...transform(-floorAreaWidthLeft, floorAreaDepth, 0),
					...transform(-floorAreaWidthLeft, floorAreaDepth, ceiling),
					...transform(floorAreaWidthRight, floorAreaDepth, ceiling),
				])
				.beginFill(0x000055, 0.8)
				.drawPolygon([
					...transform(floorAreaWidthRight, 0, ceiling),
					...transform(-floorAreaWidthLeft, 0, ceiling),
					...transform(-floorAreaWidthLeft, floorAreaDepth, ceiling),
					...transform(floorAreaWidthRight, floorAreaDepth, ceiling),
				]);
		}
	}, [projectionResolver]);

	const viewportConfig = useCallback<PixiViewportSetupCallback>((viewport) => {
		viewport
			.drag({ clampWheel: true })
			.wheel({ smooth: 10, percent: 0.1 })
			.bounce({
				...BASE_BOUNCE_OPTIONS,
				bounceBox: new Rectangle(-BONCE_OVERFLOW, -BONCE_OVERFLOW, roomBackground.imageSize[0] + 2 * BONCE_OVERFLOW, roomBackground.imageSize[1] + 2 * BONCE_OVERFLOW),
			});
	}, [roomBackground]);

	const viewportRef = useRef<PixiViewportRef>(null);

	const onDoubleClick = useEvent((event: React.PointerEvent<HTMLDivElement>) => {
		viewportRef.current?.center();
		event.stopPropagation();
		event.preventDefault();
	});

	const sceneOptions = useMemo((): GraphicsSceneProps => ({
		viewportConfig,
		viewportRef,
		forwardContexts: [directoryConnectorContext, shardConnectorContext],
		worldWidth: roomBackground.imageSize[0],
		worldHeight: roomBackground.imageSize[1],
		backgroundColor: 0x000000,
	}), [viewportConfig, viewportRef, roomBackground]);

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
							key={ character.data.id }
							globalState={ globalState }
							character={ character }
							spaceInfo={ info }
							debugConfig={ debugConfig }
							projectionResolver={ projectionResolver }
							shard={ shard }
							menuOpen={ menuOpen }
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
							roomSceneMode={ roomSceneMode }
							setRoomSceneMode={ setRoomSceneMode }
							shard={ shard }
							menuOpen={ menuOpen }
						/>
					) : null))
				}
			</Container>
			<Container zIndex={ 20 } sortableChildren>
				{
					roomDevices.map((device) => ((roomSceneMode.mode === 'moveDevice' && roomSceneMode.deviceItemId === device.id && device.isDeployed()) ? (
						<RoomDeviceMovementTool
							key={ device.id }
							globalState={ globalState }
							item={ device }
							deployment={ device.deployment }
							projectionResolver={ projectionResolver }
							roomSceneMode={ roomSceneMode }
							setRoomSceneMode={ setRoomSceneMode }
							shard={ shard }
							menuOpen={ menuOpen }
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
				background={ roomBackground.image }
				backgroundSize={ roomBackground.imageSize }
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
	const { player, playerState } = usePlayerState();
	const blindness = useCharacterRestrictionsManager(playerState, player, (manager) => manager.getBlindness());

	return useMemo((): Filter[] => {
		if (blindness === 0)
			return [];
		if (targetIsPlayer)
			return [];
		const filter = new PIXI.ColorMatrixFilter();
		filter.brightness(1 - blindness / 10, false);
		return [filter];
	}, [blindness, targetIsPlayer]);
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
			const colorFilter = new PIXI.ColorMatrixFilter();
			colorFilter.brightness(0.4, true);
			return [colorFilter];
		} else if (interfaceChatroomOfflineCharacterFilter === 'ghost') {
			const colorFilter = new PIXI.ColorMatrixFilter();
			colorFilter.brightness(0.4, true);
			const alphaFilter = new PIXI.AlphaFilter(0.8);
			return [colorFilter, alphaFilter];
		}
		AssertNever(interfaceChatroomOfflineCharacterFilter);
	}, [interfaceChatroomOfflineCharacterFilter]);

	return isOnline ? onlineFilters : offlineFilters;
}

export type IRoomSceneMode = {
	mode: 'normal';
} | {
	mode: 'moveDevice';
	deviceItemId: ItemId;
};

export function RoomScene({ className }: {
	className?: string;
}): ReactElement {
	const gameState = useGameState();
	const info = useSpaceInfo();
	const characters = useSpaceCharacters();
	const shard = useShardConnector();
	const [menuActive, setMenuActive] = useState<{
		character?: Character<ICharacterRoomData>;
		deviceItemId?: ItemId;
		position: Readonly<PointLike>;
	} | null>(null);
	const player = usePlayer();
	const debugConfig = useDebugConfig();

	const globalState = useGlobalState(gameState);

	const [roomSceneMode, setRoomSceneMode] = useState<Immutable<IRoomSceneMode>>({ mode: 'normal' });

	AssertNotNullable(characters);
	AssertNotNullable(player);

	const playerState = useCharacterState(gameState, player.id);
	AssertNotNullable(playerState);

	const roomConstructionMode = useIsRoomConstructionModeEnabled();
	useEffect(() => {
		if (!roomConstructionMode && roomSceneMode.mode === 'moveDevice') {
			setRoomSceneMode({ mode: 'normal' });
		}
	}, [roomConstructionMode, roomSceneMode]);

	const menuOpen = useCallback((target: Character<ICharacterRoomData> | ItemRoomDevice | null, event: FederatedPointerEvent | null) => {
		if (!target || !event) {
			setMenuActive(null);
		} else {
			setMenuActive({
				character: target instanceof Character ? target : undefined,
				deviceItemId: target instanceof ItemRoomDevice ? target.id : undefined,
				position: {
					x: event.pageX,
					y: event.pageY,
				},
			});
		}
	}, []);

	const onPointerDown = useEvent((event: React.PointerEvent<HTMLDivElement>) => {
		if (menuActive) {
			setMenuActive(null);
			event.stopPropagation();
			event.preventDefault();
		}
	});

	const closeContextMenu = useCallback(() => {
		setMenuActive(null);
	}, []);

	return (
		<RoomGraphicsScene
			className={ className }
			characters={ characters }
			shard={ shard }
			globalState={ globalState }
			info={ info.config }
			debugConfig={ debugConfig }
			roomSceneMode={ roomSceneMode }
			setRoomSceneMode={ setRoomSceneMode }
			onPointerDown={ onPointerDown }
			menuOpen={ menuOpen }
		>
			{
				menuActive?.character ? <CharacterContextMenu character={ menuActive.character } position={ menuActive.position } onClose={ closeContextMenu } /> : null
			}
			{
				menuActive?.deviceItemId ? (
					<DeviceContextMenu
						deviceItemId={ menuActive.deviceItemId }
						position={ menuActive.position }
						roomSceneMode={ roomSceneMode }
						setRoomSceneMode={ setRoomSceneMode }
						onClose={ closeContextMenu }
					/>
				) : null
			}
		</RoomGraphicsScene>
	);
}
