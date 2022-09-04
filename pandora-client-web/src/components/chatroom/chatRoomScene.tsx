import { AssertNotNullable, CharacterId, CharacterSize, ICharacterRoomData, IChatRoomClientData } from 'pandora-common';
import React, { ReactElement, useEffect, useRef } from 'react';
import { GraphicsManagerInstance } from '../../assets/graphicsManager';
import { Character } from '../../character/character';
import { useDebugExpose } from '../../common/useDebugExpose';
import { GraphicsCharacter } from '../../graphics/graphicsCharacter';
import { GraphicsScene, useGraphicsScene } from '../../graphics/graphicsScene';
import { useObservable } from '../../observable';
import { useChatRoomData, useChatRoomCharacters } from '../gameContext/chatRoomContextProvider';

class ChatRoomGraphicsScene extends GraphicsScene {}

class ChatRoomCharacter extends GraphicsCharacter {
	private _data: IChatRoomClientData | null = null;
	private _position: [number, number];
	private _name: Text;

	constructor(character: Character<ICharacterRoomData>, data: IChatRoomClientData | null) {
		super(character);
		this._data = data;
		this._position = character.data.position;
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
		this.addChild(this._name);
		this.on('destroy', character.on('update', this._onCharacterUpdate.bind(this)));
		this.updateRoomData(data);
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

		const relativeHeight = height / y;
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
			this._position = position;
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
}

const scene = new ChatRoomGraphicsScene();

export function ChatRoomScene(): ReactElement | null {
	const data = useChatRoomData();
	const characters = useChatRoomCharacters();
	const manager = useObservable(GraphicsManagerInstance);
	const lastManager = useRef<typeof manager>(null);
	const lastData = useRef<IChatRoomClientData | null>(null);
	const ref = useGraphicsScene<HTMLDivElement>(scene);
	const graphics = useRef<Map<CharacterId, ChatRoomCharacter>>();

	AssertNotNullable(characters);

	useDebugExpose('scene', scene);

	useEffect(() => {
		if (!manager || !graphics.current) {
			lastManager.current = manager;
			return;
		}
		if (lastManager.current !== manager) {
			for (const char of graphics.current.values()) {
				char.useGraphics(manager.getAssetGraphicsById.bind(manager));
			}
			lastManager.current = manager;
		}
	}, [manager]);

	useEffect(() => {
		graphics.current ??= new Map();
		for (const character of characters) {
			if (!graphics.current.has(character.data.id)) {
				const char = new ChatRoomCharacter(character, lastData.current);
				if (lastManager.current)
					char.useGraphics(lastManager.current.getAssetGraphicsById.bind(lastManager.current));
				scene.add(char);
				graphics.current.set(character.data.id, char);
			}
		}
		for (const [id, gChar] of graphics.current.entries()) {
			const char = characters.find((c) => c.data.id === id);
			if (!char) {
				scene.remove(gChar);
				graphics.current.delete(id);
				gChar.destroy();
			}
		}
	}, [characters]);

	useEffect(() => {
		if (!graphics.current || !data)
			return;

		if (lastData.current?.background !== data.background) {
			scene.background = data?.background;
		}

		lastData.current = data;
		for (const char of graphics.current.values()) {
			char.updateRoomData(data);
		}
	}, [data]);

	if (!data)
		return null;

	return (
		<div ref={ ref } className='chatroom-scene' />
	);
}
