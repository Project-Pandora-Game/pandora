import { AssertNotNullable, CalculateCharacterMaxYForBackground, FilterItemType, ICharacterRoomData, IChatRoomFullInfo, ItemId, ItemRoomDevice, ResolveBackground } from 'pandora-common';
import * as PIXI from 'pixi.js';
import { FederatedPointerEvent, Filter, Rectangle } from 'pixi.js';
import { Container, Graphics } from '@pixi/react';
import React, { ReactElement, useCallback, useMemo, useState } from 'react';
import { useEvent } from '../../common/useEvent';
import { Character } from '../../character/character';
import { ShardConnector } from '../../networking/shardConnector';
import { useChatRoomInfo, useChatRoomCharacters, useCharacterRestrictionsManager, ChatRoom, useCharacterState } from '../gameContext/chatRoomContextProvider';
import { useShardConnector } from '../gameContext/shardConnectorContextProvider';
import { usePlayer, usePlayerState } from '../gameContext/playerContextProvider';
import { IBounceOptions } from 'pixi-viewport';
import { CommonProps } from '../../common/reactTypes';
import { useAssetManager } from '../../assets/assetManager';
import { ChatroomDebugConfig, useDebugConfig } from './chatroomDebug';
import { PixiViewportSetupCallback } from '../../graphics/pixiViewport';
import { GraphicsBackground, GraphicsScene, GraphicsSceneProps } from '../../graphics/graphicsScene';
import { ChatRoomCharacter } from './chatRoomCharacter';
import { PointLike } from '../../graphics/graphicsCharacter';
import { ChatRoomDevice } from './chatRoomDevice';
import { useChatroomRequired } from '../gameContext/chatRoomContextProvider';
import { useRoomInventoryItems } from '../gameContext/chatRoomContextProvider';
import { shardConnectorContext } from '../gameContext/shardConnectorContextProvider';
import { DeviceContextMenu } from './contextMenus/deviceContextMenu';
import { CharacterContextMenu } from './contextMenus/characterContextMenu';

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
	roomDevices: readonly ItemRoomDevice[];
	shard: ShardConnector | null;
	room: ChatRoom;
	info: IChatRoomFullInfo;
	debugConfig: ChatroomDebugConfig;
	onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
	menuOpen: (target: Character<ICharacterRoomData> | ItemRoomDevice, event: FederatedPointerEvent) => void;
}

export function ChatRoomGraphicsScene({
	id,
	className,
	children,
	characters,
	roomDevices,
	shard,
	room,
	info,
	debugConfig,
	onPointerDown,
	menuOpen,
}: ChatRoomGraphicsSceneProps): ReactElement {
	const assetManager = useAssetManager();

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
		forwardContexts: [shardConnectorContext],
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
						<ChatRoomCharacter
							key={ character.data.id }
							room={ room }
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
						<ChatRoomDevice
							key={ device.id }
							item={ device }
							deployment={ device.deployment }
							background={ roomBackground }
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

export function ChatRoomScene({ className }: {
	className?: string;
}): ReactElement | null {
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

	const roomInventoryItems = useRoomInventoryItems(chatRoom);
	const roomDevices = useMemo(() => roomInventoryItems.filter(FilterItemType('roomDevice')), [roomInventoryItems]);

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

	if (!info)
		return null;

	return (
		<ChatRoomGraphicsScene
			className={ className }
			characters={ characters }
			roomDevices={ roomDevices }
			shard={ shard }
			room={ chatRoom }
			info={ info }
			debugConfig={ debugConfig }
			onPointerDown={ onPointerDown }
			menuOpen={ menuOpen }
		>
			{
				menuActive?.character ? <CharacterContextMenu character={ menuActive.character } position={ menuActive.position } onClose={ closeContextMenu } /> : null
			}
			{
				menuActive?.deviceItemId ? <DeviceContextMenu deviceItemId={ menuActive.deviceItemId } position={ menuActive.position } onClose={ closeContextMenu } /> : null
			}
		</ChatRoomGraphicsScene>
	);
}
