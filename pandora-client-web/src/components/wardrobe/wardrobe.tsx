import classNames from 'classnames';
import { nanoid } from 'nanoid';
import {
	Appearance,
	AppearanceAction,
	AppearanceActionContext,
	Asset,
	CharacterId,
	DoAppearanceAction,
	IsCharacterId,
	IsObject,
	Item,
} from 'pandora-common';
import React, { createContext, ReactElement, ReactNode, useContext, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { GetAssetManager } from '../../assets/assetManager';
import { Character, useCharacterAppearanceItems } from '../../character/character';
import { useObservable } from '../../observable';
import './wardrobe.scss';
import { useShardConnector } from '../gameContext/shardConnectorContextProvider';
import { GraphicsScene, useGraphicsSceneCharacter } from '../../graphics/graphicsScene';
import { useChatRoomCharacters } from '../gameContext/chatRoomContextProvider';
import { usePlayer } from '../gameContext/playerContextProvider';
import type { PlayerCharacter } from '../../character/player';

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
		const get = () => chatRoomCharacters?.find((c) => c.data.id === characterId) ?? null;
		setCharacter(get());
	}, [setCharacter, characterId, player, chatRoomCharacters]);

	if (!character?.data || !player)
		return <Link to='/pandora_lobby'>◄ Back</Link>;

	return (
		<WardrobeContextProvider character={ character } player={ player }>
			<Wardrobe />
		</WardrobeContextProvider>
	);
}

const wardrobeContext = createContext({
	character: null as unknown as Character,
	appearance: [] as readonly Item[],
	assetList: [] as readonly Asset[],
	actions: null as unknown as AppearanceActionContext,
});

function WardrobeContextProvider({ character, player, children }: { character: Character, player: PlayerCharacter, children: ReactNode }): ReactElement {
	const appearance = useCharacterAppearanceItems(character);
	const assetList = useObservable(GetAssetManager().assetList);

	const actions: AppearanceActionContext = useMemo(() => {
		const characters = new Map<CharacterId, Appearance>();
		characters.set(player.data.id, player.appearance);
		characters.set(character.data.id, character.appearance);
		return {
			player: player.data.id,
			characters,
			roomInventory: null,
		};
	}, [character.appearance, character.data.id, player.appearance, player.data.id]);

	const context = useMemo(() => ({
		character,
		appearance,
		assetList,
		actions,
	}), [appearance, character, assetList, actions]);

	return (
		<wardrobeContext.Provider value={ context }>
			{ children }
		</wardrobeContext.Provider>
	);
}

function useWardrobeContext(): Readonly<{
	character: Character,
	appearance: readonly Item[],
	assetList: readonly Asset[],
	actions: AppearanceActionContext,
}> {
	return useContext(wardrobeContext);
}

function useCreateTabContext<T extends string>(defaultValue: T, layout: Readonly<Record<T, string>>) {
	const [current, setTab] = useState(defaultValue);
	return useMemo(() => ({
		current,
		setTab: setTab as (tab: string) => void,
		layout,
	}), [current, setTab, layout]);
}

function Tabs({ context }: { context: { current: string; setTab: (tab: string) => void, layout: Readonly<Record<string, string>>  } }): ReactElement {
	const { current, setTab, layout } = context;
	return (
		<ul>
			{ Object.keys(layout).map((tab) => (
				<li key={ tab } className={ classNames('tab', { active: tab === current }) } onClick={ () => setTab(tab) }>
					{ layout[tab] }
				</li>
			)) }
		</ul>
	);
}

const TAB_LAYOUT = {
	room: 'Room inventory',
	recent: 'Recent items',
	saved: 'Saved items',
	create: 'Create new item',
} as const;

const scene = new GraphicsScene();
function Wardrobe(): ReactElement | null {
	const { character, appearance, assetList } = useWardrobeContext();
	const ref = useGraphicsSceneCharacter<HTMLDivElement>(scene, character);
	const tabs = useCreateTabContext<keyof typeof TAB_LAYOUT>('create', TAB_LAYOUT);

	return (
		<div className='wardrobe'>
			<div className='characterPreview' ref={ ref } />
			<div className='wardrobe-ui'>
				<header>
					<Tabs context={ tabs } />
				</header>
				<InventoryView title='Currently worn items' items={ appearance } ItemRow={ InventoryItemViewList } />
				{ tabs.current === 'create' && <InventoryView title='Create and use a new item' items={ assetList } ItemRow={ InventoryAssetViewList } /> }
				{ tabs.current === 'room' && <div className='inventoryView' /> }
				{ tabs.current === 'recent' && <div className='inventoryView' /> }
				{ tabs.current === 'saved' && <div className='inventoryView' /> }
			</div>
		</div>
	);
}

function InventoryView<T extends Readonly<Asset | Item>>({ title, items, ItemRow }: {
	title: string;
	items: readonly T[];
	// eslint-disable-next-line @typescript-eslint/naming-convention
	ItemRow: (_: {
		elem: T;
		listMode: boolean;
	}) => ReactElement
}): ReactElement | null {
	const [listMode, setListMode] = useState(true);
	const [filter, setFilter] = useState('');
	const flt = useDeferredValue(filter).toLowerCase().trim().split(/\s+/);

	const filteredItems = items.filter((item) => {
		if (flt.length === 0)
			return true;

		for (const f of flt) {
			const { definition } = 'asset' in item ? item.asset : item;
			if (definition.name.toLowerCase().includes(f))
				return true;
		}

		return true;
	});

	return (
		<div className='inventoryView'>
			<div className='toolbar'>
				<span>{title}</span>
				<input type='text' value={ filter } onChange={ (e) => setFilter(e.target.value) } />
				<button onClick={ () => setListMode(false) } className={ listMode ? '' : 'active' }>Grid</button>
				<button onClick={ () => setListMode(true) } className={ listMode ? 'active' : ''  }>List</button>
			</div>
			<div className={ listMode ? 'list' : 'grid' }>
				{...filteredItems
					.map((i) => <ItemRow key={ i.id } elem={ i } listMode={ listMode } />)}
			</div>
		</div>
	);
}

function InventoryAssetViewList({ elem, listMode }: { elem: Asset; listMode: boolean; }): ReactElement {
	const { actions, character } = useWardrobeContext();
	const action: AppearanceAction = {
		type: 'create',
		target: character.data.id,
		itemId: `i/${nanoid()}` as const,
		asset: elem.id,
	};
	const shardConnector = useShardConnector();
	const possible = DoAppearanceAction(action, actions, GetAssetManager(), { dryRun: true });
	return (
		<div className={ classNames('inventoryViewItem', listMode ? 'listMode' : 'gridMode', possible ? 'allowed' : 'blocked') } onClick={ () => {
			if (shardConnector && possible) {
				shardConnector.sendMessage('appearanceAction', action);
			}
		} }>
			<div className='itemPreview' />
			<span className='itemName'>{elem.definition.name}</span>
		</div>
	);
}

function InventoryItemViewList({ elem, listMode }: { elem: Item; listMode: boolean; }): ReactElement {
	const { actions, character } = useWardrobeContext();
	const action: AppearanceAction = {
		type: 'delete',
		target: character.data.id,
		itemId: elem.id,
	};
	const shardConnector = useShardConnector();
	const possible = DoAppearanceAction(action, actions, GetAssetManager(), { dryRun: true });
	return (
		<div className={ classNames('inventoryViewItem', listMode ? 'listMode' : 'gridMode', possible ? 'allowed' : 'blocked') } onClick={ () => {
			if (shardConnector && possible) {
				shardConnector.sendMessage('appearanceAction', action);
			}
		} }>
			<div className='itemPreview' />
			<span className='itemName'>{elem.asset.definition.name}</span>
		</div>
	);
}
