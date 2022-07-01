import classNames from 'classnames';
import { nanoid } from 'nanoid';
import {
	Appearance,
	AppearanceAction,
	AppearanceActionContext,
	CharacterId,
	DoAppearanceAction,
	IsCharacterId,
	IsObject,
} from 'pandora-common';
import React, { ReactElement, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { GetAssetManager } from '../../assets/assetManager';
import { Character, useCharacterAppearanceItems, useCharacterData } from '../../character/character';
import { useObservable } from '../../observable';
import './wardrobe.scss';
import { useShardConnector } from '../gameContext/shardConnectorContextProvider';
import { GraphicsScene, useGraphicsSceneCharacter } from '../../graphics/graphicsScene';
import { useChatRoomCharacters } from '../gameContext/chatRoomContextProvider';
import { usePlayer } from '../gameContext/playerContextProvider';

export function WardrobeScreen(): ReactElement | null {
	const locationState = useLocation().state;
	const player = usePlayer();
	const chatRoomCharacters = useChatRoomCharacters();

	const characterId = IsObject(locationState) && IsCharacterId(locationState.character) ? locationState.character : null;

	const [character, setCharacter] = useState<Character | null>(null);

	useEffect(() => {
		if (characterId == null || characterId === player?.data.id) {
			setCharacter(player);
			return;
		}
		const get = () => chatRoomCharacters.find((c) => c.data.id === characterId) ?? null;
		setCharacter(get());
	}, [setCharacter, characterId, player, chatRoomCharacters]);

	if (!character)
		return <Link to='/pandora_lobby'>◄ Back</Link>;

	return (
		<Wardrobe character={ character } />
	);
}

const scene = new GraphicsScene();
function Wardrobe({ character }: { character: Character }): ReactElement | null {
	const player = usePlayer();
	const characterData = useCharacterData(character);
	const assetList = useObservable(GetAssetManager().assetList);
	const appearance = useCharacterAppearanceItems(character);
	const ref = useGraphicsSceneCharacter<HTMLDivElement>(scene, character);

	if (!player || !characterData)
		return null;

	const items: InventoryItemDefinition[] = appearance.map((item) => ({
		id: item.id,
		name: item.asset.definition.name,
		action: {
			type: 'delete',
			target: character.data.id,
			itemId: item.id,
		},
	}));

	const assets: InventoryItemDefinition[] = assetList.map((asset) => ({
		id: asset.id,
		name: asset.definition.name,
		action: {
			type: 'create',
			target: character.data.id,
			itemId: `i/${nanoid()}`,
			asset: asset.id,
		},
	}));

	const characters = new Map<CharacterId, Appearance>();
	characters.set(player.data.id, player.appearance);
	characters.set(character.data.id, character.appearance);

	const context: AppearanceActionContext = {
		player: player.data.id,
		characters,
		roomInventory: null,
	};

	return (
		<div className='wardrobe'>
			<div className='characterPreview' ref={ ref } />
			<InventoryView title='Currently worn items' items={ items } context={ context } />
			<InventoryView title='Create and use a new item' items={ assets } context={ context } />
		</div>
	);
}

interface InventoryItemDefinition {
	id: string;
	name: string;
	action: AppearanceAction;
}

function InventoryView({ title, items, context }: {
	title: string;
	items: InventoryItemDefinition[];
	context: AppearanceActionContext;
}): ReactElement | null {
	const [listMode, setListMode] = useState(true);

	return (
		<div className='inventoryView'>
			<div className='toolbar'>
				<span>{title}</span>
				<button onClick={ () => setListMode(false) } className={ listMode ? '' : 'active' }>Grid</button>
				<button onClick={ () => setListMode(true) } className={ listMode ? 'active' : ''  }>List</button>
			</div>
			<div className={ listMode ? 'list' : 'grid' }>
				{...items.map((i) => <InventoryItemViewList key={ i.id } item={ i } listMode={ listMode } context={ context } />)}
			</div>
		</div>
	);
}

function InventoryItemViewList({ item, listMode, context }: { item: InventoryItemDefinition; listMode: boolean; context: AppearanceActionContext; }): ReactElement {
	const shardConnector = useShardConnector();
	const possible = DoAppearanceAction(item.action, context, GetAssetManager(), { dryRun: true });
	return (
		<div className={ classNames('inventoryViewItem', listMode ? 'listMode' : 'gridMode', possible ? 'allowed' : 'blocked') } onClick={ () => {
			if (shardConnector && possible) {
				shardConnector.sendMessage('appearanceAction', item.action);
			}
		} }>
			<div className='itemPreview' />
			<span className='itemName'>{item.name}</span>
		</div>
	);
}
