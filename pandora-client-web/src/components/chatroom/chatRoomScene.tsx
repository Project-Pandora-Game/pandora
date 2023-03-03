import { AssertNotNullable, CalculateCharacterMaxYForBackground, CharacterId, ICharacterRoomData, IChatRoomClientData, ResolveBackground } from 'pandora-common';
import * as PIXI from 'pixi.js';
import { InteractionData, Filter, Rectangle } from 'pixi.js';
import { Container, Graphics } from '@saitonakamura/react-pixi';
import React, { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEvent } from '../../common/useEvent';
import { Character, useCharacterData } from '../../character/character';
import { ShardConnector } from '../../networking/shardConnector';
import { useChatRoomData, useChatRoomCharacters, useCharacterRestrictionsManager, IsChatroomAdmin } from '../gameContext/chatRoomContextProvider';
import { useShardConnector } from '../gameContext/shardConnectorContextProvider';
import { useChatInput } from './chatInput';
import { usePlayer, usePlayerId } from '../gameContext/playerContextProvider';
import { IBounceOptions } from 'pixi-viewport';
import { CommonProps } from '../../common/reactTypes';
import { GetAssetManager, GetAssetsSourceUrl } from '../../assets/assetManager';
import { ChatroomDebugConfig, useDebugConfig } from './chatroomDebug';
import { useContextMenuPosition } from '../contextMenu/contextMenu';
import { PixiViewportSetupCallback } from '../../graphics/pixiViewport';
import { GraphicsScene, GraphicsSceneProps } from '../../graphics/graphicsScene';
import { ChatRoomCharacter } from './chatRoomCharacter';
import { useCurrentAccount, useDirectoryConnector } from '../gameContext/directoryConnectorContextProvider';

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
	data: IChatRoomClientData;
	debugConfig: ChatroomDebugConfig;
	filters: PIXI.Filter[];
	filtersExclude?: CharacterId;
	onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
	menuOpen: (character: Character<ICharacterRoomData>, data: InteractionData) => void;
}

export function ChatRoomGraphicsScene({
	id,
	className,
	children,
	characters,
	shard,
	data,
	debugConfig,
	filters,
	filtersExclude,
	onPointerDown,
	menuOpen,
}: ChatRoomGraphicsSceneProps): ReactElement {
	const assetManager = GetAssetManager();

	const roomBackground = useMemo(() => ResolveBackground(assetManager, data.background, GetAssetsSourceUrl()), [assetManager, data.background]);

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

	const sceneOptions = useMemo<GraphicsSceneProps>(() => ({
		viewportConfig,
		worldWidth: roomBackground.size[0],
		worldHeight: roomBackground.size[1],
		background: roomBackground.image,
		backgroundSize: roomBackground.size,
		backgroundFilters: filters,
	}), [viewportConfig, roomBackground, filters]);

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
							character={ character }
							data={ data }
							debugConfig={ debugConfig }
							background={ roomBackground }
							shard={ shard }
							menuOpen={ menuOpen }
							filters={ character.data.id === filtersExclude ? [] : filters }
						/>
					))
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
		</GraphicsScene>
	);
}

export function ChatRoomScene(): ReactElement | null {
	const data = useChatRoomData();
	const characters = useChatRoomCharacters();
	const shard = useShardConnector();
	const [menuActive, setMenuActive] = useState<Character<ICharacterRoomData> | null>(null);
	const [clickData, setClickData] = useState<InteractionData | null>(null);
	const player = usePlayer();
	const debugConfig = useDebugConfig();

	AssertNotNullable(characters);
	AssertNotNullable(player);

	const playerData = useCharacterData(player);

	const blindness = useCharacterRestrictionsManager(player, (manager) => manager.getBlindness());

	const menuOpen = useCallback((character: Character<ICharacterRoomData> | null, eventData: InteractionData | null) => {
		setMenuActive(character);
		setClickData(eventData);
	}, []);

	const filters = useMemo<Filter[]>(() => {
		if (blindness === 0) {
			return [];
		} else {
			const filter = new PIXI.filters.ColorMatrixFilter();
			filter.brightness(1 - blindness / 10, false);
			return [filter];
		}
	}, [blindness]);

	const onPointerDown = useEvent((event: React.PointerEvent<HTMLDivElement>) => {
		if (menuActive && clickData) {
			setMenuActive(null);
			event.stopPropagation();
			event.preventDefault();
		}
	});

	const closeContextMenu = useCallback(() => {
		setMenuActive(null);
	}, []);

	if (!data)
		return null;

	return (
		<ChatRoomGraphicsScene
			className='chatroom-scene'
			characters={ characters }
			shard={ shard }
			data={ data }
			debugConfig={ debugConfig }
			filters={ filters }
			filtersExclude={ playerData.id }
			onPointerDown={ onPointerDown }
			menuOpen={ menuOpen }
		>
			{
				menuActive ? <CharacterContextMenu character={ menuActive } data={ clickData } onClose={ closeContextMenu } /> : null
			}
		</ChatRoomGraphicsScene>
	);
}

function AdminActionContextMenu({ character, chatRoom, onClose, onBack }: { character: Character<ICharacterRoomData>; chatRoom: IChatRoomClientData; onClose: () => void; onBack: () => void; }): ReactElement {
	const isCharacterAdmin = IsChatroomAdmin(chatRoom, { id: character.data.accountId });
	const connector = useDirectoryConnector();

	const kick = useCallback(() => {
		connector.sendMessage('chatRoomAdminAction', { action: 'kick', targets: [character.data.accountId] });
		onClose();
	}, [character, connector, onClose]);

	const ban = useCallback(() => {
		connector.sendMessage('chatRoomAdminAction', { action: 'ban', targets: [character.data.accountId] });
		onClose();
	}, [character, connector, onClose]);

	const promote = useCallback(() => {
		connector.sendMessage('chatRoomAdminAction', { action: 'promote', targets: [character.data.accountId] });
		onClose();
	}, [character, connector, onClose]);

	const demote = useCallback(() => {
		connector.sendMessage('chatRoomAdminAction', { action: 'demote', targets: [character.data.accountId] });
		onClose();
	}, [character, connector, onClose]);

	return (
		<>
			<button onClick={ kick } >
				Kick
			</button>
			<button onClick={ ban } >
				Ban
			</button>
			{ isCharacterAdmin ? (
				<button onClick={ demote } >
					Demote
				</button>
			) : (
				<button onClick={ promote } >
					Promote
				</button>
			) }
			<button onClick={ onBack } >
				Back
			</button>
		</>
	);
}

function CharacterContextMenu({ character, data, onClose }: { character: Character<ICharacterRoomData>; data: InteractionData | null; onClose: () => void; }): ReactElement | null {
	const navigate = useNavigate();
	const { setTarget } = useChatInput();
	const playerId = usePlayerId();
	const currentAccount = useCurrentAccount();
	const [menu, setMenu] = useState<'main' | 'admin'>('main');

	const event = data?.originalEvent;
	const position = useMemo(() => {
		if (event instanceof MouseEvent || event instanceof PointerEvent) {
			return {
				x: event.pageX,
				y: event.pageY,
			};
		} else if (window.TouchEvent && event instanceof TouchEvent) {
			// Firefox doesn't have TouchEvent defined in PC, so we need to check if it's defined
			return {
				x: event.touches[0].pageX,
				y: event.touches[0].pageY,
			};
		}
		return {
			x: 0,
			y: 0,
		};
	}, [event]);

	const ref = useContextMenuPosition(position);

	const characterData = useCharacterData(character);
	const chatRoom = useChatRoomData();
	const isPlayerAdmin =  IsChatroomAdmin(chatRoom, currentAccount);

	useEffect(() => {
		if (!isPlayerAdmin && menu === 'admin') {
			setMenu('main');
		}
	}, [isPlayerAdmin, menu]);

	const onCloseActual = useCallback(() => {
		setMenu('main');
		onClose();
	}, [onClose]);

	if (!data || !chatRoom) {
		return null;
	}

	return (
		<div className='context-menu' ref={ ref } onPointerDown={ (e) => e.stopPropagation() }>
			<span>
				{ characterData.name } ({ characterData.id })
			</span>
			{ menu === 'main' && (
				<>
					<button onClick={ () => {
						onCloseActual();
						navigate('/wardrobe', { state: { character: characterData.id } });
					} }>
						Wardrobe
					</button>
					{ characterData.id !== playerId && (
						<button onClick={ () => {
							onClose();
							setTarget(characterData.id);
						} }>
							Whisper
						</button>
					) }
				</>
			) }
			{ (isPlayerAdmin && character.data.accountId !== currentAccount?.id) && (
				<>
					{ menu === 'main' ? (
						<button onClick={ () => setMenu('admin') }>
							Admin
						</button>
					) : (
						<AdminActionContextMenu character={ character } chatRoom={ chatRoom } onClose={ onCloseActual } onBack={ () => setMenu('main') } />
					) }
				</>
			) }
			<button onClick={ () => {
				onCloseActual();
			} } >
				Close
			</button>
		</div>
	);
}
