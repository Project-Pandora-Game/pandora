import { CharacterId, ICharacterRoomData, IChatRoomClientData } from 'pandora-common';
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

	constructor(character: Character<ICharacterRoomData>, data: IChatRoomClientData | null) {
		super(character);
		this._data = data;
		[this.x, this.y] = character.data.position;
		this.on('destroy', character.on('update', ({ position }) => {
			if (position) {
				[this.x, this.y] = position;
				this.updateRoomData(this._data);
			}
		}));
		this.updateRoomData(data);
	}

	updateRoomData(data: IChatRoomClientData | null) {
		this._data = data;
		// TODO: scaling
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
