import { AssertNotNullable, CharacterId, CharacterSize, ICharacterRoomData, IChatRoomClientData } from 'pandora-common';
import { IBounceOptions } from 'pixi-viewport';
import { Graphics, InteractionEvent, Point, Rectangle, Text } from 'pixi.js';
import React, { ReactElement, useEffect } from 'react';
import { GraphicsManager, GraphicsManagerInstance } from '../../assets/graphicsManager';
import { Character } from '../../character/character';
import { useDebugExpose } from '../../common/useDebugExpose';
import { GraphicsCharacter } from '../../graphics/graphicsCharacter';
import { GraphicsScene, useGraphicsScene } from '../../graphics/graphicsScene';
import { Clamp } from '../../graphics/utility';
import { ShardConnector } from '../../networking/shardConnector';
import { useChatRoomData, useChatRoomCharacters } from '../gameContext/chatRoomContextProvider';
import { useShardConnector } from '../gameContext/shardConnectorContextProvider';
import _ from 'lodash';

class ChatRoomCharacter extends GraphicsCharacter<Character<ICharacterRoomData>> {
	private _data: IChatRoomClientData | null = null;
	private _name: Text;
	private _dragging?: Point;

	// Calculated properties
	private _yOffset: number = 0;
	private _scale: number = 0;

	private get _position(): [number, number] {
		return this.appearanceContainer.data.position;
	}

	private _setPositionRaw(x: number, y: number): void {
		x = Clamp(x, 0, this._data?.size[0] ?? 0);
		y = Clamp(y, 0, this._data?.size[1] ?? 0)
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

	constructor(character: Character<ICharacterRoomData>, data: IChatRoomClientData | null, shard: ShardConnector | null) {
		super(character);
		this._data = data;
		this.shard = shard;
		this._name = new Text(`${character.data.name} (${character.data.id})`, {
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
			.on('pointerdown', this._onDragStart.bind(this))
			.on('pointerup', this._onDragEnd.bind(this))
			.on('pointerupoutside', this._onDragEnd.bind(this))
			.on('pointermove', this._onDragMove.bind(this));
	}

	updateRoomData(data: IChatRoomClientData | null) {
		this._data = data;
		this._reposition();
	}

	private _getTextHeightOffset() {
		return 100 + (this.getBoneLikeValue("kneeling") * 2);
	}

	private _getTextSize() {
		// TODO: set it based on scaling
		return 32;
	}

	private _updateTextPosition() {
		const x = CharacterSize.WIDTH / 2;
		const y = CharacterSize.HEIGHT - this._getTextHeightOffset();
		this.hitArea = new Rectangle(x - 50, y - 25, 100, 50);
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

		const scaling = this._data.scaling;

		if (scaling < 1) {
			this._scale = 1;
		} else {
			const relativeHeight = y / height;
			const minScale = 1 / scaling;
			this._scale = 1 - (1 - minScale) * relativeHeight;
		}

		this._yOffset = this.getBoneLikeValue("kneeling") * 2;

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

	private _onDragStart(event: InteractionEvent) {
		event.stopPropagation();
		if (this._dragging) return;
		this._dragging = event.data.getLocalPosition(this.parent);
	}

	private _onDragEnd(_event: InteractionEvent) {
		this._dragging = undefined;
	}

	private _onDragMove(event: InteractionEvent) {
		if (!this._dragging || !this._data) return;
		event.stopPropagation();
		const dragPointerEnd = event.data.getLocalPosition(this.parent);

		const [width, height] = this._data.size;
		const scaling = this._data.scaling;

		const minScale = 1 / scaling;
		const y = height * (height - dragPointerEnd.y + this._yOffset - this._getTextHeightOffset()) / (height + 1 - minScale);

		this.setPositionThrottled(dragPointerEnd.x, y);
	}
}

const CHARACTER_INDEX_START = 100;
const BONCE_OVERFLOW = 500;
const BASE_BOUNCE_OPTIONS: IBounceOptions = {
	ease: 'easeOutQuad',
	friction: 0,
	sides: 'all',
	time: 500,
	underflow: 'center',
};

class ChatRoomGraphicsScene extends GraphicsScene {
	private readonly _characters: Map<CharacterId, ChatRoomCharacter> = new Map();
	private _shard: ShardConnector | null = null;
	private _room: IChatRoomClientData | null = null;
	private _manager: GraphicsManager | null = GraphicsManagerInstance.value;

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
			const graphics = new ChatRoomCharacter(character, this._room, this._shard);
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
		if (this._room?.background !== data.background) {
			this.background = data.background;
		}
		if (!this._room || this._room.size[0] !== data.size[0] || this._room.size[1] !== data.size[1]) {
			const container = this.container;
			container.worldHeight = data.size[1] + BONCE_OVERFLOW * 2;
			container.worldWidth = data.size[0] + BONCE_OVERFLOW * 2;
			this.container.bounce({
				...BASE_BOUNCE_OPTIONS,
				bounceBox: new Rectangle(-BONCE_OVERFLOW, -BONCE_OVERFLOW, data.size[0] + BONCE_OVERFLOW, data.size[1] + BONCE_OVERFLOW),
			});
			this._border.clear().lineStyle(2, 0x404040, 0.4).drawRect(0, 0, data.size[0], data.size[1]);
		}
		this._room = data;
		this._characters.forEach((character) => {
			character.updateRoomData(data);
		});
	}
}

const scene = new ChatRoomGraphicsScene();

export function ChatRoomScene(): ReactElement | null {
	const data = useChatRoomData();
	const characters = useChatRoomCharacters();
	const ref = useGraphicsScene<HTMLDivElement>(scene);
	const shard = useShardConnector();

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

	if (!data)
		return null;

	return (
		<div ref={ ref } className='chatroom-scene' />
	);
}
