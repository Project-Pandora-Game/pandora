import { AppearanceChangeType, AssertNotNullable, AssetManager, CalculateCharacterMaxYForBackground, CharacterId, CharacterSize, CharacterView, DEFAULT_BACKGROUND, ICharacterRoomData, IChatroomBackgroundData, IChatRoomClientData, ResolveBackground } from 'pandora-common';
import { IBounceOptions } from 'pixi-viewport';
import { AbstractRenderer, Filter, Graphics, InteractionData, InteractionEvent, Point, Rectangle, Text, filters, Container } from 'pixi.js';
import React, { CSSProperties, ReactElement, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useEvent } from '../../common/useEvent';
import { GraphicsManager, GraphicsManagerInstance } from '../../assets/graphicsManager';
import { Character } from '../../character/character';
import { useDebugExpose } from '../../common/useDebugExpose';
import { GraphicsCharacter } from '../../graphics/graphicsCharacter';
import { GraphicsScene } from '../../graphics/graphicsScene';
import { ShardConnector } from '../../networking/shardConnector';
import { useChatRoomData, useChatRoomCharacters, useCharacterRestrictionsManager } from '../gameContext/chatRoomContextProvider';
import { useShardConnector } from '../gameContext/shardConnectorContextProvider';
import { useChatInput } from './chatInput';
import { usePlayer, usePlayerId } from '../gameContext/playerContextProvider';
import _, { noop } from 'lodash';
import { GraphicsSceneRenderer } from '../../graphics/graphicsSceneRenderer';
import { GetAssetManager, GetAssetsSourceUrl } from '../../assets/assetManager';
import { ChatroomDebugConfig, useDebugConfig } from './chatroomDebug';

const BOTTOM_NAME_OFFSET = 100;
const CHARACTER_WAIT_DRAG_THRESHOLD = 100; // ms
const CHARACTER_INDEX_START = 100;
const BONCE_OVERFLOW = 500;
const BASE_BOUNCE_OPTIONS: IBounceOptions = {
	ease: 'easeOutQuad',
	friction: 0,
	sides: 'all',
	time: 500,
	underflow: 'center',
};

type ChatRoomCharacterProps<Self extends GraphicsCharacter<Character<ICharacterRoomData>>> = {
	character: Character<ICharacterRoomData>;
	data: IChatRoomClientData | null;
	debugConfig: ChatroomDebugConfig;
	background: IChatroomBackgroundData;
	shard: ShardConnector | null;
	menuOpen: (character: Self, data: InteractionData) => void;
	flts: Filter[];
	renderer: AbstractRenderer;
};

class ChatRoomCharacter extends GraphicsCharacter<Character<ICharacterRoomData>> {
	private _data: IChatRoomClientData | null = null;
	private _debugConfig: ChatroomDebugConfig;
	private _background: Readonly<IChatroomBackgroundData> = DEFAULT_BACKGROUND;
	private _menuOpen: (character: ChatRoomCharacter, data: InteractionData) => void;
	private _name: Text;

	private _dragging?: Point;
	private _pointerDown = false;
	private _waitPonterUp: number | null = null;

	// Calculated properties
	private _yOffset: number = 0;
	private _scale: number = 1;
	private _scaleX: number = 1;

	// Debug data
	private _debugGraphicsContainer: Container;
	private _debugHitboxOverlay: Graphics;

	public get characterRoomPosition(): [number, number] {
		return this.appearanceContainer.data.position;
	}

	private _setPositionRaw(x: number, y: number): void {
		const maxY = CalculateCharacterMaxYForBackground(this._background);

		x = _.clamp(Math.round(x), 0, this._background.size[0]);
		y = _.clamp(Math.round(y), 0, maxY);

		if (this.characterRoomPosition[0] === x && this.characterRoomPosition[1] === y || !this.shard) {
			return;
		}
		this.shard?.sendMessage('chatRoomCharacterMove', {
			id: this.appearanceContainer.data.id,
			position: [x, y],
		});
	}

	private readonly setPositionThrottled = _.throttle(this._setPositionRaw.bind(this), 100);

	shard: ShardConnector | null;

	public get id(): CharacterId {
		return this.appearanceContainer.data.id;
	}

	constructor({ character, data, debugConfig, background, shard, menuOpen, flts, renderer }: ChatRoomCharacterProps<ChatRoomCharacter>) {
		super(character, renderer);
		this.name = character.data.name;
		this._data = data;
		this._background = background;
		this.shard = shard;
		this._menuOpen = menuOpen;
		this._name = new Text(this.name, {
			fontFamily: 'Arial',
			fontSize: this._getTextSize(),
			fill: character.data.settings.labelColor,
			align: 'center',
			dropShadow: true,
			dropShadowBlur: 4,
		});
		this.filters = flts;

		// Setup debug graphics
		this._debugGraphicsContainer = new Container();
		this._debugGraphicsContainer.visible = false;
		this._debugGraphicsContainer.zIndex = 99999;
		this.addChild(this._debugGraphicsContainer);
		const characterFrame = new Graphics()
			.lineStyle({ color: 0x00ff00, width: 2 })
			.drawRect(0, 0, CharacterSize.WIDTH, CharacterSize.HEIGHT);
		this._debugGraphicsContainer.addChild(characterFrame);
		this._debugHitboxOverlay = new Graphics();
		this._debugGraphicsContainer.addChild(this._debugHitboxOverlay);

		const cleanupCalls: (() => void)[] = [];

		cleanupCalls.push(character.on('update', this._onCharacterUpdate.bind(this)));

		this._name.anchor.set(0.5, 0.5);
		this.interactive = true;
		this.addChild(this._name);
		this.updateRoomData(data, background, debugConfig);
		this
			.on('destroyed', () => cleanupCalls.forEach((c) => c()))
			.on('pointerdown', this._onPointerDown.bind(this))
			.on('pointerup', this._onPointerUp.bind(this))
			.on('pointerupoutside', this._onPointerUp.bind(this))
			.on('pointermove', this._onPointerMove.bind(this));
	}

	updateRoomData(data: IChatRoomClientData | null, background: Readonly<IChatroomBackgroundData>, debugConfig?: ChatroomDebugConfig) {
		this._data = data;
		this._debugConfig = debugConfig;
		this._background = background;
		this._reposition();
	}

	updateMenuOpen(open: (character: ChatRoomCharacter, data: InteractionData) => void) {
		this._menuOpen = open;
	}

	private _getTextSize() {
		// TODO: set it based on scaling
		return 32;
	}

	private _updateTextPosition() {
		const x = CharacterSize.WIDTH / 2;
		const y = CharacterSize.HEIGHT - BOTTOM_NAME_OFFSET - this._yOffset;
		const hitArea = this.hitArea = new Rectangle(x - 100, y - 50, 200, 100);
		this._name.position.set(x, y);
		this._name.scale.set(1 / this._scaleX, 1);
		// Debug graphics
		if (this._debugConfig) {
			this._debugHitboxOverlay
				.clear()
				.beginFill(0xff0000, 0.25)
				.drawRect(hitArea.x, hitArea.y, hitArea.width, hitArea.height);
		}
	}

	private _onCharacterUpdate({ position, settings }: Partial<ICharacterRoomData>) {
		if (position) {
			this._reposition();
		}
		if (settings) {
			this._name.style.fill = settings.labelColor;
		}
	}

	protected override update(changes: AppearanceChangeType[]): void {
		super.update(changes);
		this._reposition();
	}

	private _reposition() {
		if (!this._data) {
			return;
		}

		const [width, height] = this._background.size;
		const scaling = this._background.scaling;
		const x = Math.min(width, this.characterRoomPosition[0]);
		const y = Math.min(height, this.characterRoomPosition[1]);

		let baseScale = 1;
		if (this.getBoneLikeValue('sitting') > 0) {
			baseScale *= 0.9;
		}

		this._scale = baseScale * (1 - (y * scaling) / height);

		const backView = this.appearanceContainer.appearance.getView() === CharacterView.BACK;
		this._scaleX = backView ? -1 : 1;

		this._yOffset = 0
			+ 1.75 * this.getBoneLikeValue('kneeling')
			+ 0.75 * this.getBoneLikeValue('sitting')
			+ (this.getBoneLikeValue('kneeling') === 0 ? -0.2 : 0) * this.getBoneLikeValue('tiptoeing');

		const oldY = this.y;

		this.scale.set(this._scaleX * this._scale, this._scale);
		this.x = x;
		this.pivot.y = CharacterSize.HEIGHT - this._yOffset;
		this.y = height - y;

		this._updateTextPosition();

		// Show or hide debug data
		this._debugGraphicsContainer.visible = !!this._debugConfig?.characterDebugOverlay;

		if (oldY !== this.y) {
			this.emit('YChanged', this.y);
		}
	}

	private _onPointerDown(_event: InteractionEvent) {
		this._pointerDown = true;
		if (this._waitPonterUp) {
			clearTimeout(this._waitPonterUp);
			this._waitPonterUp = null;
		}
		this._waitPonterUp = setTimeout(() => {
			this._waitPonterUp = null;
		}, CHARACTER_WAIT_DRAG_THRESHOLD);
	}

	private _onPointerUp(event: InteractionEvent) {
		this._dragging = undefined;
		this._pointerDown = false;
		if (this._waitPonterUp) {
			clearTimeout(this._waitPonterUp);
			this._waitPonterUp = null;
			this._menuOpen(this, event.data);
		}
	}

	private _onPointerMove(event: InteractionEvent) {
		if (this._dragging) {
			this._onDragMove(event);
		} else if (!this._waitPonterUp && this._pointerDown) {
			this._onDragStart(event);
		}
	}

	private _onDragStart(event: InteractionEvent) {
		event.stopPropagation();
		if (this._dragging) return;
		this._dragging = event.data.getLocalPosition(this.parent);
	}

	private _onDragMove(event: InteractionEvent) {
		if (!this._dragging || !this._data) return;
		event.stopPropagation();
		const dragPointerEnd = event.data.getLocalPosition(this.parent);

		const height = this._background.size[1];
		const scaling = this._background.scaling;

		let baseScale = 1;
		if (this.getBoneLikeValue('sitting') > 0) {
			baseScale *= 0.9;
		}

		const y = (dragPointerEnd.y - height + baseScale * BOTTOM_NAME_OFFSET) / ((scaling / height) * baseScale * BOTTOM_NAME_OFFSET - 1);

		this.setPositionThrottled(dragPointerEnd.x, y);
	}
}

class ChatRoomGraphicsScene extends GraphicsScene {
	private readonly _characters: Map<CharacterId, ChatRoomCharacter> = new Map();
	private _shard: ShardConnector | null = null;
	private _room: IChatRoomClientData | null = null;
	private _debugConfig: ChatroomDebugConfig;
	private _roomBackground: Readonly<IChatroomBackgroundData> = DEFAULT_BACKGROUND;
	private _manager: GraphicsManager | null = GraphicsManagerInstance.value;
	private _menuOpen: (Character: ChatRoomCharacter, data: InteractionData) => void = noop;
	private _filterExclude?: CharacterId;

	private readonly _border: Graphics;

	private readonly _calibrationLine = new Graphics();

	constructor() {
		super();
		this.container
			.drag({ clampWheel: true })
			.wheel({ smooth: 10, percent: 0.1 })
			.bounce({ ...BASE_BOUNCE_OPTIONS });

		this._border = this.container.addChild(new Graphics());
		this._border.zIndex = 2;

		this._calibrationLine.zIndex = -1;
		this.container.addChild(this._calibrationLine);

		GraphicsManagerInstance.subscribe((manager) => {
			if (manager) {
				this._manager = manager;
				for (const [, character] of this._characters) {
					character.useGraphics(manager.getAssetGraphicsById.bind(manager));
				}
			}
		});
	}

	override destroy(): void {
		this.clear();
		super.destroy();
	}

	public reorderCharacters() {
		if (this.destroyed)
			return;
		let orderChanged = false;
		[...this._characters.values()]
			.sort((a, b) => b.characterRoomPosition[1] - a.characterRoomPosition[1])
			.forEach((character, index) => {
				if (character.zIndex !== index + CHARACTER_INDEX_START) {
					character.zIndex = index + CHARACTER_INDEX_START;
					orderChanged = true;
				}
			});

		if (orderChanged) {
			this.container.sortChildren();
		}
	}

	public clear() {
		this._characters.forEach((character) => {
			character.destroy();
			this.remove(character);
		});
		this._characters.clear();
	}

	public updateCharacters(data: readonly Character<ICharacterRoomData>[]) {
		if (this.destroyed)
			return;
		for (const [id, character] of this._characters) {
			if (!data.some((c) => c.data.id === id)) {
				character.destroy();
				this._characters.delete(id);
			}
		}
		for (const character of data) {
			if (this._characters.has(character.data.id)) {
				continue;
			}
			const graphics = new ChatRoomCharacter({
				character,
				data: this._room,
				debugConfig: this._debugConfig,
				background: this._roomBackground,
				shard: this._shard,
				menuOpen: this._menuOpen,
				flts: character.data.id === this._filterExclude ? [] : this.backgroundFilters,
				renderer: this.renderer,
			});
			if (this._manager) {
				graphics.useGraphics(this._manager.getAssetGraphicsById.bind(this._manager));
			}
			graphics.on('YChanged', () => this.reorderCharacters());
			this._characters.set(character.data.id, graphics);
			this.add(graphics);
		}
		this.reorderCharacters();
	}

	public updateShard(shard: ShardConnector | null) {
		if (this.destroyed)
			return;
		if (this._shard === shard) {
			return;
		}
		this._shard = shard;
		this._characters.forEach((character) => {
			character.shard = shard;
		});
	}

	public updateRoomData(data: IChatRoomClientData, assetManager: AssetManager, debugConfig?: ChatroomDebugConfig) {
		if (this.destroyed)
			return;
		if (this._room === data && this._debugConfig === debugConfig) {
			return;
		}

		const roomBackground = ResolveBackground(assetManager, data.background, GetAssetsSourceUrl());

		// Calculate scaling calibration helper
		this._calibrationLine.clear();
		if (debugConfig?.roomScalingHelper) {
			const maxY = CalculateCharacterMaxYForBackground(roomBackground);
			const scaleAtMaxY = 1 - (maxY * roomBackground.scaling) / roomBackground.size[1];

			this._calibrationLine.beginFill(0x550000, 0.8);
			this._calibrationLine.drawPolygon([
				0.6 * roomBackground.size[0], roomBackground.size[1],
				0.4 * roomBackground.size[0], roomBackground.size[1],
				(0.5 - 0.1 * scaleAtMaxY) * roomBackground.size[0], roomBackground.size[1] - maxY,
				(0.5 + 0.1 * scaleAtMaxY) * roomBackground.size[0], roomBackground.size[1] - maxY,
			]);
			this._calibrationLine.beginFill(0x990000, 0.6);
			this._calibrationLine.drawPolygon([
				0.55 * roomBackground.size[0], roomBackground.size[1],
				0.45 * roomBackground.size[0], roomBackground.size[1],
				0.5 * roomBackground.size[0], (1 - 1/roomBackground.scaling) * roomBackground.size[1],
			]);
		}

		const sizeChanged = !this._room || this._roomBackground.size[0] !== roomBackground.size[0] || this._roomBackground.size[1] !== roomBackground.size[1];
		if (this._roomBackground.image !== roomBackground.image || sizeChanged) {
			this.setBackground(roomBackground.image, roomBackground.size[0], roomBackground.size[1]);
		}
		this._roomBackground = roomBackground;
		if (sizeChanged) {
			const container = this.container;
			container.worldHeight = roomBackground.size[1];
			container.worldWidth = roomBackground.size[0];
			this.resize(true);
			this.container.bounce({
				...BASE_BOUNCE_OPTIONS,
				bounceBox: new Rectangle(-BONCE_OVERFLOW, -BONCE_OVERFLOW, roomBackground.size[0] + 2 * BONCE_OVERFLOW, roomBackground.size[1] + 2 * BONCE_OVERFLOW),
			});
			this._border.clear().lineStyle(2, 0x404040, 0.4).drawRect(0, 0, roomBackground.size[0], roomBackground.size[1]);
		}
		this._room = data;
		this._debugConfig = debugConfig;
		this._characters.forEach((character) => {
			character.updateRoomData(data, roomBackground, debugConfig);
		});
	}

	updateMenuOpen(open: (character: ChatRoomCharacter, data: InteractionData) => void) {
		if (this.destroyed)
			return;
		this._menuOpen = open;
		this._characters.forEach((character) => {
			character.updateMenuOpen(open);
		});
	}

	updateFilters(flts: Filter[], exclude?: CharacterId) {
		if (this.destroyed)
			return;
		this._filterExclude = exclude;
		this._characters.forEach((character) => {
			if (character.id !== exclude) {
				character.filters = flts;
			}
		});
		this.setBackgroundFilters(flts);
	}
}

export function ChatRoomScene(): ReactElement | null {
	const data = useChatRoomData();
	const characters = useChatRoomCharacters();
	const shard = useShardConnector();
	const [menuActive, setMenuActive] = useState<ChatRoomCharacter | null>(null);
	const [clickData, setClickData] = useState<InteractionData | null>(null);
	const player = usePlayer();
	const debugConfig = useDebugConfig();

	const [scene, setScene] = useState<ChatRoomGraphicsScene | null>(null);
	const sceneCreator = useCallback(() => new ChatRoomGraphicsScene(), []);

	AssertNotNullable(characters);
	AssertNotNullable(player);

	const blindness = useCharacterRestrictionsManager(player, (manager) => manager.getBlindness());

	useDebugExpose('scene', scene);

	useEffect(() => {
		if (characters) {
			scene?.updateCharacters(characters);
		}
	}, [scene, characters]);

	useEffect(() => {
		scene?.updateShard(shard);
	}, [scene, shard]);

	useEffect(() => {
		if (data) {
			scene?.updateRoomData(data, GetAssetManager(), debugConfig);
		}
	}, [scene, data, debugConfig]);

	useEffect(() => {
		scene?.updateMenuOpen((character, eventData) => {
			setClickData(eventData);
			setMenuActive(character);
		});
	}, [scene, setMenuActive, setClickData]);

	useEffect(() => {
		if (blindness === 0) {
			scene?.updateFilters([]);
		} else {
			const filter = new filters.ColorMatrixFilter();
			filter.brightness(1 - blindness / 10, false);
			scene?.updateFilters([filter], player.data.id);
		}
	}, [scene, blindness, player.data.id]);

	const onPointerDown = useEvent((event: React.PointerEvent<HTMLDivElement>) => {
		if (menuActive && clickData) {
			setMenuActive(null);
			event.stopPropagation();
			event.preventDefault();
		}
	});

	if (!data)
		return null;

	return (
		<GraphicsSceneRenderer scene={ sceneCreator } onScene={ setScene } className='chatroom-scene' onPointerDown={ onPointerDown }>
			<CharacterContextMenu character={ menuActive } data={ clickData } onClose={ () => setMenuActive(null) } />
		</GraphicsSceneRenderer>
	);
}

function CharacterContextMenu({ character, data, onClose }: { character: ChatRoomCharacter | null; data: InteractionData | null; onClose: () => void; }): ReactElement | null {
	const { setTarget } = useChatInput();
	const playerId = usePlayerId();

	if (!character || !data) {
		return null;
	}

	const event = data?.originalEvent;
	const style: CSSProperties = {};
	if (event instanceof MouseEvent || event instanceof PointerEvent) {
		style.left = event.pageX;
		style.top = event.pageY;
	} else if (event instanceof TouchEvent) {
		style.left = event.touches[0].pageX;
		style.top = event.touches[0].pageY;
	}

	return (
		<div className='context-menu' style={ style } onPointerDown={ (e) => e.stopPropagation() }>
			<span>
				{ character.name } ({ character.id })
			</span>
			<Link to='/wardrobe' state={ { character: character.id } }>
				Wardrobe
			</Link>
			{ character.id !== playerId && (
				<span onClick={ () => setTarget(character.id) }>
					Whisper
				</span>
			) }
			<span onClick={ onClose } >
				Close
			</span>
		</div>
	);
}
