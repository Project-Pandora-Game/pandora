import { AssertNotNullable, CharacterId, CharacterSize, ICharacterRoomData, IChatRoomClientData } from 'pandora-common';
import { IBounceOptions } from 'pixi-viewport';
import { InteractionEvent, Point, Rectangle, Text } from 'pixi.js';
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

class ChatRoomCharacter extends GraphicsCharacter<Character<ICharacterRoomData>> {
	private _data: IChatRoomClientData | null = null;
	private _name: Text;
	private _dragging?: Point;

	private get _position(): [number, number] {
		return this.appearanceContainer.data.position;
	}

	private set _position(value: [number, number]) {
		if (this._position[0] === value[0] && this._position[1] === value[1]) {
			return;
		}
		this.shard?.sendMessage('chatRoomCharacterMove', {
			id: this.appearanceContainer.data.id,
			position: [
				Clamp(value[0], 0, this._data?.size[0] ?? 0),
				Clamp(value[1], 0, this._data?.size[1] ?? 0),
			],
		});
	}

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
		this._name.anchor.set(0.5, 0.5);
		this._name.y = CharacterSize.HEIGHT - this._getTextHeightOffset();
		this._name.x = CharacterSize.WIDTH / 2;
		this.interactive = true;
		this.addChild(this._name);
		this.updateRoomData(data);
		this
			.on('destroy', character.on('update', this._onCharacterUpdate.bind(this)))
			.on('pointerdown', this._onDragStart.bind(this))
			.on('pointerup', this._onDragEnd.bind(this))
			.on('pointerupoutside', this._onDragEnd.bind(this))
			.on('pointermove', this._onDragMove.bind(this));
	}

	updateRoomData(data: IChatRoomClientData | null) {
		this._data = data;
		if (!this._data) {
			return;
		}
		const height = this._data.size[1];
		const y = Math.min(height, this._position[1]);
		const scaling = this._data.scaling;

		if (y === 0 || scaling < 1) {
			this._setScale(1);
			return;
		}

		const relativeHeight = y / height;
		const minScale = 1 / scaling;
		this._setScale(1 - (1 - minScale) * relativeHeight);
	}

	private _getTextHeightOffset() {
		// TODO: change this based on pose
		return 100;
	}

	private _getTextSize() {
		// TODO: set it based on scaling
		return 32;
	}

	private _onCharacterUpdate({ position, settings }: Partial<ICharacterRoomData>) {
		if (position) {
			this.updateRoomData(this._data);
		}
		if (settings) {
			this._name.style.fill = settings.labelColor;
		}
	}

	private _setScale(scale: number) {
		if (!this._data) {
			return;
		}
		const [width, height] = this._data.size;
		const [x, y] = this._position;
		this.scale.set(scale, scale);
		this.x = Math.min(width, x);
		this.y = 0 - Math.min(height, y) - (CharacterSize.HEIGHT * scale - CharacterSize.HEIGHT) / 2;
	}

	private _onDragStart(event: InteractionEvent) {
		event.stopPropagation();
		if (this._dragging) return;
		this._dragging = event.data.getLocalPosition(this);
	}

	private _onDragEnd(_event: InteractionEvent) {
		this._dragging = undefined;
	}

	private _onDragMove(event: InteractionEvent) {
		if (!this._dragging) return;
		event.stopPropagation();
		const dragPointerEnd = event.data.getLocalPosition(this);
		this._position = [
			this._position[0] + (dragPointerEnd.x - this._dragging.x),
			this._position[1] - (dragPointerEnd.y - this._dragging.y),
		];
	}
}

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

	constructor() {
		super();
		this.container
			.drag({ clampWheel: true })
			.wheel({ smooth: 10, percent: 0.1 })
			.bounce({ ...BASE_BOUNCE_OPTIONS });
		GraphicsManagerInstance.subscribe((manager) => {
			if (manager) {
				this._manager = manager;
				for (const [, character] of this._characters) {
					character.useGraphics(manager.getAssetGraphicsById.bind(manager));
				}
			}
		});
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
			if (!data.find((c) => c.data.id === id)) {
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
			this._characters.set(character.data.id, graphics);
			this.add(graphics);
		}
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
