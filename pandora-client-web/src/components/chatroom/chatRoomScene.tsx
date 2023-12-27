import { AssertNever, AssertNotNullable, AssetFrameworkGlobalState, CalculateCharacterMaxYForBackground, FilterItemType, ICharacterRoomData, IChatRoomClientInfo, ItemId, ItemRoomDevice, ResolveBackground } from 'pandora-common';
import * as PIXI from 'pixi.js';
import { FederatedPointerEvent, Filter, Rectangle } from 'pixi.js';
import { Container, Graphics } from '@pixi/react';
import React, { ReactElement, useCallback, useMemo, useState } from 'react';
import { useEvent } from '../../common/useEvent';
import { Character, useCharacterData } from '../../character/character';
import { ShardConnector } from '../../networking/shardConnector';
import { useChatRoomInfo, useChatRoomCharacters, useCharacterRestrictionsManager, useCharacterState, useRoomState } from '../gameContext/chatRoomContextProvider';
import { useShardConnector } from '../gameContext/shardConnectorContextProvider';
import { usePlayer, usePlayerState } from '../gameContext/playerContextProvider';
import { IBounceOptions } from 'pixi-viewport';
import { CommonProps } from '../../common/reactTypes';
import { useAssetManager } from '../../assets/assetManager';
import { ChatroomDebugConfig, useDebugConfig } from './chatroomDebug';
import { PixiViewportSetupCallback } from '../../graphics/pixiViewport';
import { GraphicsBackground, GraphicsScene, GraphicsSceneProps } from '../../graphics/graphicsScene';
import { ChatRoomCharacterInteractive } from './chatRoomCharacter';
import { PointLike } from '../../graphics/graphicsCharacter';
import { ChatRoomDeviceInteractive, ChatRoomDeviceMovementTool } from './chatRoomDevice';
import { useChatroomRequired } from '../gameContext/chatRoomContextProvider';
import { shardConnectorContext } from '../gameContext/shardConnectorContextProvider';
import { DeviceContextMenu } from './contextMenus/deviceContextMenu';
import { CharacterContextMenu } from './contextMenus/characterContextMenu';
import { directoryConnectorContext, useCurrentAccountSettings } from '../gameContext/directoryConnectorContextProvider';
import { Immutable } from 'immer';

const BONCE_OVERFLOW = 500;
const BASE_BOUNCE_OPTIONS: IBounceOptions = {
	ease: 'easeOutQuad',
	friction: 0,
	sides: 'all',
	time: 500,
	underflow: 'center',
};

interface ChatRoomGraphicsSceneProps extends CommonProps {
	characters: readonly Character<ICharacterRoomData>[];
	shard: ShardConnector | null;
	globalState: AssetFrameworkGlobalState;
	info: Immutable<IChatRoomClientInfo>;
	debugConfig: ChatroomDebugConfig;
	chatRoomMode: Immutable<IChatRoomMode>;
	setChatRoomMode: (newMode: Immutable<IChatRoomMode>) => void;
	onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
	menuOpen: (target: Character<ICharacterRoomData> | ItemRoomDevice, event: FederatedPointerEvent) => void;
}

export function ChatRoomGraphicsScene({
	id,
	className,
	children,
	characters,
	shard,
	globalState,
	info,
	debugConfig,
	chatRoomMode,
	setChatRoomMode,
	onPointerDown,
	menuOpen,
}: ChatRoomGraphicsSceneProps): ReactElement {
	const assetManager = useAssetManager();

	const roomState = globalState.room;
	const roomDevices = useMemo((): readonly ItemRoomDevice[] => (roomState?.items.filter(FilterItemType('roomDevice')) ?? []), [roomState]);
	const roomBackground = useMemo(() => ResolveBackground(assetManager, info.background), [assetManager, info.background]);

	const borderDraw = useCallback((g: PIXI.Graphics) => {
		g.clear()
			.lineStyle(2, 0x404040, 0.4)
			.drawRect(0, 0, roomBackground.size[0], roomBackground.size[1]);
	}, [roomBackground]);

	const calibrationLineDraw = useCallback((g: PIXI.Graphics) => {
		const maxY = CalculateCharacterMaxYForBackground(roomBackground);
		const scaleAtMaxY = 1 - (maxY * roomBackground.scaling) / roomBackground.size[1];

		g.clear()
			.beginFill(0x550000, 0.8)
			.drawPolygon([
				0.6 * roomBackground.size[0], roomBackground.size[1],
				0.4 * roomBackground.size[0], roomBackground.size[1],
				(0.5 - 0.1 * scaleAtMaxY) * roomBackground.size[0], roomBackground.size[1] - maxY,
				(0.5 + 0.1 * scaleAtMaxY) * roomBackground.size[0], roomBackground.size[1] - maxY,
			])
			.beginFill(0x990000, 0.6)
			.drawPolygon([
				0.55 * roomBackground.size[0], roomBackground.size[1],
				0.45 * roomBackground.size[0], roomBackground.size[1],
				0.5 * roomBackground.size[0], (1 - 1 / roomBackground.scaling) * roomBackground.size[1],
			]);
	}, [roomBackground]);

	const viewportConfig = useCallback<PixiViewportSetupCallback>((viewport) => {
		viewport
			.drag({ clampWheel: true })
			.wheel({ smooth: 10, percent: 0.1 })
			.bounce({ ...BASE_BOUNCE_OPTIONS })
			.bounce({
				...BASE_BOUNCE_OPTIONS,
				bounceBox: new Rectangle(-BONCE_OVERFLOW, -BONCE_OVERFLOW, roomBackground.size[0] + 2 * BONCE_OVERFLOW, roomBackground.size[1] + 2 * BONCE_OVERFLOW),
			});
	}, [roomBackground]);

	const sceneOptions = useMemo((): GraphicsSceneProps => ({
		viewportConfig,
		forwardContexts: [directoryConnectorContext, shardConnectorContext],
		worldWidth: roomBackground.size[0],
		worldHeight: roomBackground.size[1],
		backgroundColor: 0x000000,
	}), [viewportConfig, roomBackground]);

	return (
		<GraphicsScene
			id={ id }
			className={ className }
			divChildren={ children }
			onPointerDown={ onPointerDown }
			sceneOptions={ sceneOptions }
		>
			<Graphics
				zIndex={ 2 }
				draw={ borderDraw }
			/>
			<Container zIndex={ 10 } sortableChildren>
				{
					characters.map((character) => (
						<ChatRoomCharacterInteractive
							key={ character.data.id }
							globalState={ globalState }
							character={ character }
							roomInfo={ info }
							debugConfig={ debugConfig }
							background={ roomBackground }
							shard={ shard }
							menuOpen={ menuOpen }
						/>
					))
				}
				{
					roomDevices.map((device) => (device.deployment != null ? (
						<ChatRoomDeviceInteractive
							key={ device.id }
							globalState={ globalState }
							item={ device }
							deployment={ device.deployment }
							background={ roomBackground }
							chatRoomMode={ chatRoomMode }
							setChatRoomMode={ setChatRoomMode }
							shard={ shard }
							menuOpen={ menuOpen }
						/>
					) : null))
				}
			</Container>
			<Container zIndex={ 20 } sortableChildren>
				{
					roomDevices.map((device) => ((chatRoomMode.mode === 'moveDevice' && chatRoomMode.deviceItemId === device.id && device.deployment != null) ? (
						<ChatRoomDeviceMovementTool
							key={ device.id }
							globalState={ globalState }
							item={ device }
							deployment={ device.deployment }
							background={ roomBackground }
							chatRoomMode={ chatRoomMode }
							setChatRoomMode={ setChatRoomMode }
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
				backgroundSize={ roomBackground.size }
				backgroundFilters={ usePlayerVisionFilters(false) }
			/>
		</GraphicsScene>
	);
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

	const { interfaceChatroomOfflineCharacterFilter } = useCurrentAccountSettings();

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

export type IChatRoomMode = {
	mode: 'normal';
} | {
	mode: 'moveDevice';
	deviceItemId: ItemId;
};

export function ChatRoomScene({ className }: {
	className?: string;
}): ReactElement {
	const chatRoom = useChatroomRequired();
	const info = useChatRoomInfo();
	const characters = useChatRoomCharacters();
	const shard = useShardConnector();
	const [menuActive, setMenuActive] = useState<{
		character?: Character<ICharacterRoomData>;
		deviceItemId?: ItemId;
		position: Readonly<PointLike>;
	} | null>(null);
	const player = usePlayer();
	const debugConfig = useDebugConfig();

	const globalState = useRoomState(chatRoom);

	const [chatRoomMode, setChatRoomMode] = useState<Immutable<IChatRoomMode>>({ mode: 'normal' });

	AssertNotNullable(characters);
	AssertNotNullable(player);

	const playerState = useCharacterState(chatRoom, player.id);
	AssertNotNullable(playerState);

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
		<ChatRoomGraphicsScene
			className={ className }
			characters={ characters }
			shard={ shard }
			globalState={ globalState }
			info={ info.config }
			debugConfig={ debugConfig }
			chatRoomMode={ chatRoomMode }
			setChatRoomMode={ setChatRoomMode }
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
						chatRoomMode={ chatRoomMode }
						setChatRoomMode={ setChatRoomMode }
						onClose={ closeContextMenu }
					/>
				) : null
			}
		</ChatRoomGraphicsScene>
	);
}
