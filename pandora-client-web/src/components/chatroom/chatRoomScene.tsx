import { AppearanceAction, AssertNotNullable, CalculateCharacterMaxYForBackground, DoAppearanceAction, CharacterId, EMPTY_ARRAY, FilterItemType, ICharacterRoomData, IChatRoomFullInfo, ItemId, ItemRoomDevice, ResolveBackground } from 'pandora-common';
import * as PIXI from 'pixi.js';
import { FederatedPointerEvent, Filter, Rectangle } from 'pixi.js';
import { Container, Graphics } from '@pixi/react';
import React, { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEvent } from '../../common/useEvent';
import { AppearanceContainer, Character, useCharacterData } from '../../character/character';
import { ShardConnector } from '../../networking/shardConnector';
import { useChatRoomInfo, useChatRoomCharacters, useCharacterRestrictionsManager, IsChatroomAdmin, ChatRoom, useCharacterState, useChatroom } from '../gameContext/chatRoomContextProvider';
import { useShardConnector } from '../gameContext/shardConnectorContextProvider';
import { useChatInput } from './chatInput';
import { usePlayer, usePlayerId } from '../gameContext/playerContextProvider';
import { IBounceOptions } from 'pixi-viewport';
import { ChildrenProps, CommonProps } from '../../common/reactTypes';
import { useAssetManager, GetAssetsSourceUrl } from '../../assets/assetManager';
import { ChatroomDebugConfig, useDebugConfig } from './chatroomDebug';
import { useContextMenuPosition } from '../contextMenu/contextMenu';
import { PixiViewportSetupCallback } from '../../graphics/pixiViewport';
import { GraphicsScene, GraphicsSceneProps } from '../../graphics/graphicsScene';
import { ChatRoomCharacter } from './chatRoomCharacter';
import { useCurrentAccount, useDirectoryConnector } from '../gameContext/directoryConnectorContextProvider';
import { PointLike } from '../../graphics/graphicsCharacter';
import { ChatRoomDevice } from './chatRoomDevice';
import { useChatroomRequired } from '../gameContext/chatRoomContextProvider';
import { useRoomInventoryItems } from '../gameContext/chatRoomContextProvider';
import { shardConnectorContext } from '../gameContext/shardConnectorContextProvider';
import { WardrobeContextProvider, useWardrobeContext } from '../wardrobe/wardrobe';
import { nanoid } from 'nanoid';

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
	filters: PIXI.Filter[];
	filtersExclude?: readonly (CharacterId | ItemId)[];
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
	filters,
	filtersExclude = EMPTY_ARRAY,
	onPointerDown,
	menuOpen,
}: ChatRoomGraphicsSceneProps): ReactElement {
	const assetManager = useAssetManager();

	const roomBackground = useMemo(() => ResolveBackground(assetManager, info.background, GetAssetsSourceUrl()), [assetManager, info.background]);

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
		forwardContexts: [shardConnectorContext],
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
							room={ room }
							character={ character }
							roomInfo={ info }
							debugConfig={ debugConfig }
							background={ roomBackground }
							shard={ shard }
							menuOpen={ menuOpen }
							filters={ filtersExclude.includes(character.id) ? EMPTY_ARRAY : filters }
						/>
					))
				}
				{
					roomDevices.map((device) => (device.deployment != null ? (
						<ChatRoomDevice
							key={ device.id }
							item={ device }
							deployment={ device.deployment }
							debugConfig={ debugConfig }
							background={ roomBackground }
							shard={ shard }
							menuOpen={ menuOpen }
							filters={ filtersExclude.includes(device.id) ? EMPTY_ARRAY : filters }
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
		</GraphicsScene>
	);
}

export function ChatRoomScene(): ReactElement | null {
	const chatRoom = useChatroomRequired();
	const info = useChatRoomInfo();
	const characters = useChatRoomCharacters();
	const shard = useShardConnector();
	const [menuActive, setMenuActive] = useState<{
		character?: Character<ICharacterRoomData>;
		device?: ItemRoomDevice;
		position: Readonly<PointLike>;
	} | null>(null);
	const player = usePlayer();
	const debugConfig = useDebugConfig();

	const roomInventoryItems = useRoomInventoryItems(chatRoom);
	const roomDevices = useMemo(() => roomInventoryItems.filter(FilterItemType('roomDevice')), [roomInventoryItems]);

	AssertNotNullable(characters);
	AssertNotNullable(player);

	const playerData = useCharacterData(player);
	const playerState = useCharacterState(chatRoom, player.id);
	AssertNotNullable(playerState);

	const blindness = useCharacterRestrictionsManager(playerState, player, (manager) => manager.getBlindness());

	const menuOpen = useCallback((target: Character<ICharacterRoomData> | ItemRoomDevice | null, event: FederatedPointerEvent | null) => {
		if (!target || !event) {
			setMenuActive(null);
		} else {
			setMenuActive({
				character: target instanceof Character ? target : undefined,
				device: target instanceof ItemRoomDevice ? target : undefined,
				position: {
					x: event.pageX,
					y: event.pageY,
				},
			});
		}
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
			className='chatroom-scene'
			characters={ characters }
			roomDevices={ roomDevices }
			shard={ shard }
			room={ chatRoom }
			info={ info }
			debugConfig={ debugConfig }
			filters={ filters }
			filtersExclude={ [playerData.id] }
			onPointerDown={ onPointerDown }
			menuOpen={ menuOpen }
		>
			{
				menuActive && menuActive.character ? <CharacterContextMenu character={ menuActive.character } position={ menuActive.position } onClose={ closeContextMenu } /> : null
			}
			{
				menuActive && menuActive.device ? <DeviceContextMenu device={ menuActive.device } position={ menuActive.position } onClose={ closeContextMenu } /> : null
			}
		</ChatRoomGraphicsScene>
	);
}

function AdminActionContextMenu({ character, chatRoomInfo, onClose, onBack }: { character: Character<ICharacterRoomData>; chatRoomInfo: IChatRoomFullInfo; onClose: () => void; onBack: () => void; }): ReactElement {
	const isCharacterAdmin = IsChatroomAdmin(chatRoomInfo, { id: character.data.accountId });
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

function CharacterContextMenu({ character, position, onClose }: {
	character: Character<ICharacterRoomData>;
	position: Readonly<PointLike>;
	onClose: () => void;
}): ReactElement | null {
	const navigate = useNavigate();
	const { setTarget } = useChatInput();
	const playerId = usePlayerId();
	const currentAccount = useCurrentAccount();
	const [menu, setMenu] = useState<'main' | 'admin'>('main');

	const ref = useContextMenuPosition(position);

	const characterData = useCharacterData(character);
	const chatRoomInfo = useChatRoomInfo();
	const isPlayerAdmin = IsChatroomAdmin(chatRoomInfo, currentAccount);

	useEffect(() => {
		if (!isPlayerAdmin && menu === 'admin') {
			setMenu('main');
		}
	}, [isPlayerAdmin, menu]);

	const onCloseActual = useCallback(() => {
		setMenu('main');
		onClose();
	}, [onClose]);

	if (!event || !chatRoomInfo) {
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
						<AdminActionContextMenu character={ character } chatRoomInfo={ chatRoomInfo } onClose={ onCloseActual } onBack={ () => setMenu('main') } />
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

function StoreDeviceMenu({ device, close }: {
	device: ItemRoomDevice;
	close: () => void;
}) {
	const assetManager = useAssetManager();
	const { actions, execute } = useWardrobeContext();
	const action = useMemo<AppearanceAction>(() => ({
		type: 'roomDeviceDeploy',
		item: {
			container: [],
			itemId: device.id,
		},
		target: { type: 'roomInventory' },
		deployment: null,
	}), [device]);
	const available = useMemo(() => DoAppearanceAction(action, actions, assetManager, { dryRun: true }).result === 'success', [action, actions, assetManager]);
	const onClick = useCallback(() => {
		execute(action);
		close();
	}, [action, execute, close]);

	if (!available) {
		return null;
	}

	return (
		<button onClick={ onClick }>
			Store the device
		</button>
	);
}

function DeviceSlotClear({ device, slot, children, close }: ChildrenProps & {
	device: ItemRoomDevice;
	slot: string;
	close: () => void;
}) {
	const assetManager = useAssetManager();
	const { actions, execute } = useWardrobeContext();
	const action = useMemo<AppearanceAction | undefined>(() => slot ? ({
		type: 'roomDeviceLeave',
		item: {
			container: [],
			itemId: device.id,
		},
		target: { type: 'roomInventory' },
		slot,
	}) : undefined, [device, slot]);
	const available = useMemo(() => action && DoAppearanceAction(action, actions, assetManager, { dryRun: true }).result === 'success', [action, actions, assetManager]);
	const onClick = useCallback(() => {
		if (action)
			execute(action);

		close();
	}, [action, execute, close]);

	if (!available) {
		return null;
	}

	return (
		<button onClick={ onClick }>
			{ children }
		</button>
	);
}

function LeaveDeviceMenu({ device, close }: {
	device: ItemRoomDevice;
	close: () => void;
}) {
	const { player } = useWardrobeContext();
	const slot = useMemo(() => [...device.slotOccupancy.entries()].find(([, id]) => id === player.id)?.[0], [device, player]);
	if (!slot)
		return null;

	return (
		<DeviceSlotClear device={ device } slot={ slot } close={ close }>
			Exit the device
		</DeviceSlotClear>
	);
}

function OccupyDeviceSlotMenu({ device, slot, character, close }: {
	device: ItemRoomDevice;
	slot: string;
	character: AppearanceContainer;
	close: () => void;
}) {
	const assetManager = useAssetManager();
	const { actions, execute } = useWardrobeContext();
	const action = useMemo<AppearanceAction>(() => ({
		type: 'roomDeviceEnter',
		item: {
			container: [],
			itemId: device.id,
		},
		target: { type: 'roomInventory' },
		slot,
		character: {
			type: 'character',
			characterId: character.id,
		},
		itemId: `i/${nanoid()}` as const,
	}), [device, slot, character]);
	const available = useMemo(() => DoAppearanceAction(action, actions, assetManager, { dryRun: true }).result === 'success', [action, actions, assetManager]);
	const onClick = useCallback(() => {
		execute(action);
		close();
	}, [action, execute, close]);

	if (!available) {
		return null;
	}

	return (
		<button onClick={ onClick }>
			{ character.name } ({ character.id })
		</button>
	);
}

function DeviceSlotsMenu({ device }: {
	device: ItemRoomDevice;
	close: () => void;
}) {
	const [slot, setSlot] = useState<string | null>(null);
	const occupancy = useMemo(() => slot && device.slotOccupancy.get(slot), [device, slot]);
	const { player } = useWardrobeContext();
	const chatRoomCharacters = useChatRoomCharacters();
	const characters = useMemo<readonly AppearanceContainer[]>(() => chatRoomCharacters || [player], [chatRoomCharacters, player]);
	const character = useMemo(() => characters.find(({ id }) => id === occupancy), [characters, occupancy]);

	if (!slot) {
		return (
			<>
				{ Object.entries(device.asset.definition.slots).map(([name, definition]) => (
					<button key={ name } onClick={ () => setSlot(name) }>
						{ definition.name }
					</button>
				)) }
			</>
		);
	}

	if (occupancy) {
		return (
			<>
				<span>
					{ device.asset.definition.slots[slot].name }
				</span>
				<span>
					{ character?.name } ({ character?.id })
				</span>
				<DeviceSlotClear device={ device } slot={ slot } close={ close }>
					{ (occupancy === player.id)
						? 'Exit the device'
						: 'Clear occupancy of the slot' }
				</DeviceSlotClear>
				<button onClick={ () => setSlot(null) }>
					Back to slots
				</button>
			</>
		);
	}

	return (
		<>
			<span>
				{ device.asset.definition.slots[slot].name }
			</span>
			<span>
				Enter:
			</span>
			{ characters.map((char) => (
				<OccupyDeviceSlotMenu key={ char.id } device={ device } slot={ slot } character={ char } close={ close } />
			)) }
			<button onClick={ () => setSlot(null) }>
				Back to slots
			</button>
		</>
	);
}

function DeviceContextMenu({ device, position, onClose }: {
	device: ItemRoomDevice;
	position: Readonly<PointLike>;
	onClose: () => void;
}): ReactElement | null {
	const ref = useContextMenuPosition(position);
	const player = usePlayer();
	const chatRoom = useChatroom();
	const [menu, setMenu] = useState<'main' | 'slots'>('main');

	if (!player || !chatRoom) {
		return null;
	}

	return (
		<div className='context-menu' ref={ ref } onPointerDown={ (e) => e.stopPropagation() }>
			<span>
				{ device.asset.definition.name }
			</span>
			<WardrobeContextProvider target={ chatRoom } player={ player }>
				{ menu === 'main' && (
					<>
						<LeaveDeviceMenu device={ device } close={ onClose } />
						<button onClick={ () => setMenu('slots') }>
							Slots
						</button>
						<StoreDeviceMenu device={ device } close={ onClose } />
					</>
				) }
				{ menu === 'slots' && (
					<>
						<DeviceSlotsMenu device={ device } close={ onClose } />
						<button onClick={ () => setMenu('main') }>
							Back
						</button>
					</>
				) }
			</WardrobeContextProvider>
			<button onClick={ onClose } >
				Close
			</button>
		</div>
	);
}
