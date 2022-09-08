import { AssertNotNullable, CharacterId, CharacterSize, ICharacterRoomData, IChatRoomClientData } from 'pandora-common';
import { IBounceOptions } from 'pixi-viewport';
import { Graphics, InteractionData, InteractionEvent, Point, Rectangle, Text } from 'pixi.js';
import React, { CSSProperties, ReactElement, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useEvent } from '../../common/useEvent';
import { GraphicsManager, GraphicsManagerInstance } from '../../assets/graphicsManager';
import { Character } from '../../character/character';
import { useDebugExpose } from '../../common/useDebugExpose';
import { GraphicsCharacter } from '../../graphics/graphicsCharacter';
import { GraphicsScene, useGraphicsScene } from '../../graphics/graphicsScene';
import { ShardConnector } from '../../networking/shardConnector';
import { useChatRoomData, useChatRoomCharacters } from '../gameContext/chatRoomContextProvider';
import { useShardConnector } from '../gameContext/shardConnectorContextProvider';
import _, { noop } from 'lodash';

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
	shard: ShardConnector | null;
	menuOpen: (character: Self, data: InteractionData) => void;
};
class ChatRoomCharacter extends GraphicsCharacter<Character<ICharacterRoomData>> {
	private _data: IChatRoomClientData | null = null;
	private _menuOpen: (character: ChatRoomCharacter, data: InteractionData) => void;
	private _name: Text;

	private _dragging?: Point;
	private _pointerDown = false;
	private _waitPonterUp: number | null = null;

	// Calculated properties
	private _yOffset: number = 0;
	private _scale: number = 0;

	private get _position(): [number, number] {
		return this.appearanceContainer.data.position;
	}

	private _setPositionRaw(x: number, y: number): void {
		x = _.clamp(x, 0, this._data?.size[0] ?? 0);
		y = _.clamp(y, 0, this._data?.size[1] ?? 0);
		if (this._position[0] === x && this._position[1] === y || !this.shard) {
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

	constructor({ character, data, shard, menuOpen }: ChatRoomCharacterProps<ChatRoomCharacter>) {
		super(character);
		this.name = character.data.name;
		this._data = data;
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

		const cleanupCalls: (() => void)[] = [];

		cleanupCalls.push(character.on('appearanceUpdate', () => {
			this._updateTextPosition();
		}));
		cleanupCalls.push(character.on('update', this._onCharacterUpdate.bind(this)));

		this._name.anchor.set(0.5, 0.5);
		this.interactive = true;
		this._updateTextPosition();
		this.addChild(this._name);
		this.updateRoomData(data);
		this
			.on('destroy', () => cleanupCalls.forEach((c) => c()))
			.on('pointerdown', this._onPointerDown.bind(this))
			.on('pointerup', this._onPointerUp.bind(this))
			.on('pointerupoutside', this._onPointerUp.bind(this))
			.on('pointermove', this._onPointerMove.bind(this));
	}

	updateRoomData(data: IChatRoomClientData | null) {
		this._data = data;
		this._reposition();
	}

	updateMenuOpen(open: (character: ChatRoomCharacter, data: InteractionData) => void) {
		this._menuOpen = open;
	}

	private _getTextHeightOffset() {
		return 100 + (this.getBoneLikeValue('kneeling') * 2);
	}

	private _getTextSize() {
		// TODO: set it based on scaling
		return 32;
	}

	private _updateTextPosition() {
		const x = CharacterSize.WIDTH / 2;
		const y = CharacterSize.HEIGHT - this._getTextHeightOffset();
		this.hitArea = new Rectangle(x - 100, y - 50, 200, 100);
		this._name.x = x;
		this._name.y = y;
	}

	private _onCharacterUpdate({ position, settings }: Partial<ICharacterRoomData>) {
		if (position) {
			this.updateRoomData(this._data);
		}
		if (settings) {
			this._name.style.fill = settings.labelColor;
		}
	}

	private _reposition() {
		if (!this._data) {
			return;
		}

		const [width, height] = this._data.size;
		const x = Math.min(width, this._position[0]);
		const y = Math.min(height, this._position[1]);

		const scaling = Math.max(1, this._data.scaling);
		const relativeHeight = y / height;
		const minScale = 1 / scaling;
		this._scale = 1 - (1 - minScale) * relativeHeight;

		this._yOffset = this.getBoneLikeValue('kneeling') * 2;

		const oldY = this.y;

		this.scale.set(this._scale);
		this.x = x;
		this.y = height
			- CharacterSize.HEIGHT * this._scale
			- y
			+ this._yOffset;

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

		const height = this._data.size[1];
		const scaling = Math.max(1, this._data.scaling);
		const minScale = 1 / scaling;

		const y = (dragPointerEnd.y - height - this._yOffset + this._getTextHeightOffset()) / ((1 - minScale) * (this._getTextHeightOffset() / height) - 1);

		this.setPositionThrottled(dragPointerEnd.x, y);
	}
}

class ChatRoomGraphicsScene extends GraphicsScene {
	private readonly _characters: Map<CharacterId, ChatRoomCharacter> = new Map();
	private _shard: ShardConnector | null = null;
	private _room: IChatRoomClientData | null = null;
	private _manager: GraphicsManager | null = GraphicsManagerInstance.value;
	private _menuOpen: (Character: ChatRoomCharacter, data: InteractionData) => void = noop;

	private readonly _border: Graphics;

	constructor() {
		super();
		this.container
			.drag({ clampWheel: true })
			.wheel({ smooth: 10, percent: 0.1 })
			.bounce({ ...BASE_BOUNCE_OPTIONS });

		this._border = this.container.addChild(new Graphics());
		this._border.zIndex = 2;

		GraphicsManagerInstance.subscribe((manager) => {
			if (manager) {
				this._manager = manager;
				for (const [, character] of this._characters) {
					character.useGraphics(manager.getAssetGraphicsById.bind(manager));
				}
			}
		});
	}

	public reorderCharacters() {
		let orderChanged = false;
		[...this._characters.values()]
			.sort((a, b) => a.y - b.y)
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
		for (const [id, character] of this._characters) {
			if (!data.some((c) => c.data.id === id)) {
				character.destroy();
				this._characters.delete(id);
			}
		}
		for (const character of data) {
			if (this._characters.has(character.data.id)) {
				return;
			}
			const graphics = new ChatRoomCharacter({ character, data: this._room, shard: this._shard, menuOpen: this._menuOpen });
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
		if (this._shard === shard) {
			return;
		}
		this._shard = shard;
		this._characters.forEach((character) => {
			character.shard = shard;
		});
	}

	public updateRoomData(data: IChatRoomClientData) {
		if (this._room === data) {
			return;
		}
		const sizeChanged = !this._room || this._room.size[0] !== data.size[0] || this._room.size[1] !== data.size[1];
		if (this._room?.background !== data.background || sizeChanged) {
			this.setBackground(data.background, data.size[0], data.size[1]);
		}
		if (sizeChanged) {
			const container = this.container;
			container.worldHeight = data.size[1];
			container.worldWidth = data.size[0];
			this.resize(true);
			this.container.bounce({
				...BASE_BOUNCE_OPTIONS,
				bounceBox: new Rectangle(-BONCE_OVERFLOW, -BONCE_OVERFLOW, data.size[0] + 2 * BONCE_OVERFLOW, data.size[1] + 2 * BONCE_OVERFLOW),
			});
			this._border.clear().lineStyle(2, 0x404040, 0.4).drawRect(0, 0, data.size[0], data.size[1]);
		}
		this._room = data;
		this._characters.forEach((character) => {
			character.updateRoomData(data);
		});
	}

	updateMenuOpen(open: (character: ChatRoomCharacter, data: InteractionData) => void) {
		this._menuOpen = open;
		this._characters.forEach((character) => {
			character.updateMenuOpen(open);
		});
	}
}

const scene = new ChatRoomGraphicsScene();

export function ChatRoomScene(): ReactElement | null {
	const data = useChatRoomData();
	const characters = useChatRoomCharacters();
	const ref = useGraphicsScene<HTMLDivElement>(scene);
	const shard = useShardConnector();
	const [menuActive, setMenuActive] = useState<ChatRoomCharacter | null>(null);
	const [clickData, setClickData] = useState<InteractionData | null>(null);

	AssertNotNullable(characters);

	useDebugExpose('scene', scene);

	useEffect(() => {
		if (characters) {
			scene.updateCharacters(characters);
		}
	}, [characters]);

	useEffect(() => {
		scene.updateShard(shard);
	}, [shard]);

	useEffect(() => {
		if (data) {
			scene.updateRoomData(data);
		}
	}, [data]);

	useEffect(() => {
		scene.updateMenuOpen((character, eventData) => {
			setClickData(eventData);
			setMenuActive(character);
		});
	}, [setMenuActive, setClickData]);

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
		<div ref={ ref } className='chatroom-scene' onPointerDown={ onPointerDown }>
			<CharacterContextMenu character={ menuActive } data={ clickData } onClose={ () => setMenuActive(null) } />
		</div>
	);
}

function CharacterContextMenu({ character, data, onClose }: { character: ChatRoomCharacter | null; data: InteractionData | null; onClose: () => void; }): ReactElement | null {
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
			<span onClick={ onClose } >
				Close
			</span>
		</div>
	);
}
