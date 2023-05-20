import classNames from 'classnames';
import { nanoid } from 'nanoid';
import {
	AppearanceAction,
	AppearanceActionContext,
	AppearanceActionResult,
	AppearanceArmPose,
	AppearanceItemProperties,
	AppearanceItems,
	AppearanceLimitTree,
	ArmRotationSchema,
	Assert,
	AssertNever,
	AssertNotNullable,
	Asset,
	AssetColorization,
	AssetFrameworkCharacterState,
	AssetFrameworkGlobalState,
	AssetFrameworkRoomState,
	AssetsPosePresets,
	BONE_MAX,
	BONE_MIN,
	BoneName,
	BoneState,
	CharacterAppearance,
	CharacterArmsPose,
	CharacterId,
	CharacterIdSchema,
	ColorGroupResult,
	DoAppearanceAction,
	EMPTY_ARRAY,
	FormatTimeInterval,
	HexColorString,
	IsCharacterId,
	IsObject,
	Item,
	ItemContainerPath,
	ItemId,
	ItemPath,
	MessageSubstitute,
	RoomDeviceDeployment,
	RoomDeviceSlot,
	RoomInventory,
	RoomTargetSelector,
	Writeable,
} from 'pandora-common';
import React, { createContext, ReactElement, ReactNode, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AssetManagerClient, useAssetManager } from '../../assets/assetManager';
import { AppearanceContainer, Character, useCharacterAppearanceArmsPose, useCharacterAppearanceItems, useCharacterAppearancePose, useCharacterAppearanceView } from '../../character/character';
import { Observable, useObservable } from '../../observable';
import './wardrobe.scss';
import { useShardConnector } from '../gameContext/shardConnectorContextProvider';
import { IChatRoomContext, useActionRoomContext, useChatroom, useChatRoomCharacters, useChatRoomInfo, useChatroomRequired, useRoomState } from '../gameContext/chatRoomContextProvider';
import { usePlayer, usePlayerId } from '../gameContext/playerContextProvider';
import type { PlayerCharacter } from '../../character/player';
import { Tab, TabContainer } from '../common/tabs/tabs';
import { FieldsetToggle } from '../common/fieldsetToggle';
import { Button, ButtonProps, IconButton } from '../common/button/button';
import { USER_DEBUG } from '../../config/Environment';
import _ from 'lodash';
import { CommonProps } from '../../common/reactTypes';
import { useEvent } from '../../common/useEvent';
import { ItemModuleTyped } from 'pandora-common/dist/assets/modules/typed';
import { IItemModule } from 'pandora-common/dist/assets/modules/common';
import { DEFAULT_BACKGROUND_COLOR, GraphicsScene, GraphicsSceneProps } from '../../graphics/graphicsScene';
import { GraphicsCharacter } from '../../graphics/graphicsCharacter';
import { ColorInput, ColorInputRGBA } from '../common/colorInput/colorInput';
import { Column, Row } from '../common/container/container';
import { ItemModuleStorage } from 'pandora-common/dist/assets/modules/storage';
import { ItemModuleLockSlot } from 'pandora-common/dist/assets/modules/lockSlot';
import { EvalItemPath, SplitContainerPath } from 'pandora-common/dist/assets/appearanceHelpers';
import emptyLock from '../../assets/icons/lock_empty.svg';
import closedLock from '../../assets/icons/lock_closed.svg';
import openLock from '../../assets/icons/lock_open.svg';
import { AppearanceActionResultShouldHide, RenderAppearanceActionResult } from '../../assets/appearanceValidation';
import { HoverElement } from '../hoverElement/hoverElement';
import { CharacterSafemodeWarningContent } from '../characterSafemode/characterSafemode';
import listIcon from '../../assets/icons/list.svg';
import gridIcon from '../../assets/icons/grid.svg';
import { useGraphicsUrl } from '../../assets/graphicsManager';
import { useCurrentTime } from '../../common/useCurrentTime';
import { Select } from '../common/select/select';
import { useCurrentAccount, useDirectoryConnector } from '../gameContext/directoryConnectorContextProvider';
import { Immutable } from 'immer';
import { useUpdatedUserInput } from '../../common/useSyncUserInput';
import { useItemColorString } from '../../graphics/graphicsLayer';

export function GenerateRandomItemId(): ItemId {
	return `i/${nanoid()}` as const;
}

export function WardrobeScreen(): ReactElement | null {
	const locationState = useLocation().state as unknown;
	const player = usePlayer();
	const chatRoom = useChatroom();
	const isInRoom = useChatRoomInfo() != null;
	const chatRoomCharacters = useChatRoomCharacters();

	const characterId = IsObject(locationState) && IsCharacterId(locationState.character) ? locationState.character : null;
	const targetIsRoomInventory = IsObject(locationState) && locationState.target === 'room';

	const [character, setCharacter] = useState<Character | null>(null);

	useEffect(() => {
		if (characterId == null || characterId === player?.data.id) {
			setCharacter(player);
			return;
		}
		const get = () => chatRoomCharacters?.find((c) => c.data.id === characterId) ?? null;
		setCharacter(get());
	}, [setCharacter, characterId, player, chatRoomCharacters]);

	const target: WardrobeTarget | null =
		targetIsRoomInventory ? (
			isInRoom ? chatRoom : null
		) : (
			character?.data ? character : null
		);

	if (!player || !target)
		return <Link to='/pandora_lobby'>◄ Back</Link>;

	return (
		<WardrobeContextProvider target={ target } player={ player }>
			<Wardrobe />
		</WardrobeContextProvider>
	);
}

export type WardrobeContextExtraItemActionComponent = (props: { item: ItemPath; }) => ReactElement;
export type WardrobeTarget = AppearanceContainer | IChatRoomContext;

export interface WardrobeContext {
	target: WardrobeTarget;
	targetSelector: RoomTargetSelector;
	player: AppearanceContainer;
	globalState: AssetFrameworkGlobalState;
	assetList: readonly Asset[];
	extraItemActions: Observable<readonly WardrobeContextExtraItemActionComponent[]>;
	actions: AppearanceActionContext;
	execute: (action: AppearanceAction) => void;
}

export interface WardrobeFocus {
	container: ItemContainerPath;
	itemId: ItemId | null;
}

export function WardrobeFocusesItem(focus: WardrobeFocus): focus is ItemPath {
	return focus.itemId != null;
}

export const wardrobeContext = createContext<WardrobeContext | null>(null);

export function WardrobeContextProvider({ target, player, children }: { target: WardrobeTarget; player: PlayerCharacter; children: ReactNode; }): ReactElement {
	const assetList = useAssetManager().assetList;
	const room = useChatroomRequired();
	const globalStateContainer = room.globalState;
	const roomContext = useActionRoomContext();
	const shardConnector = useShardConnector();
	const chatroomCharacters: readonly AppearanceContainer[] = useChatRoomCharacters() ?? EMPTY_ARRAY;

	const extraItemActions = useMemo(() => new Observable<readonly WardrobeContextExtraItemActionComponent[]>([]), []);

	const actions = useMemo<AppearanceActionContext>(() => ({
		player: player.data.id,
		globalState: globalStateContainer,
		getCharacter: (id) => {
			const state = globalStateContainer.currentState.getCharacterState(id);
			const character = chatroomCharacters.find((c) => c.id === id);
			if (!state || !character)
				return null;

			return character.getRestrictionManager(state, roomContext);
		},
		getTarget: (actionTarget) => {
			if (actionTarget.type === 'character') {
				const state = globalStateContainer.currentState.getCharacterState(actionTarget.characterId);
				const character = chatroomCharacters.find((c) => c.id === actionTarget.characterId);
				if (!state || !character)
					return null;

				return character.getAppearance(state);
			}

			if (actionTarget.type === 'roomInventory') {
				const roomState = globalStateContainer.currentState.room;
				if (!roomState)
					return null;

				return new RoomInventory(roomState);
			}

			AssertNever(actionTarget);
		},
	}), [player, globalStateContainer, roomContext, chatroomCharacters]);

	const targetSelector = useMemo<RoomTargetSelector>(() => {
		if (target.type === 'character') {
			return {
				type: 'character',
				characterId: target.id,
			};
		} else if (target.type === 'room') {
			return {
				type: 'roomInventory',
			};
		}
		AssertNever(target);
	}, [target]);

	const globalState = useRoomState(room);

	const context = useMemo<WardrobeContext>(() => ({
		target,
		targetSelector,
		player,
		globalState,
		assetList,
		extraItemActions,
		actions,
		execute: (action) => shardConnector?.sendMessage('appearanceAction', action),
	}), [target, targetSelector, player, globalState, assetList, extraItemActions, actions, shardConnector]);

	return (
		<wardrobeContext.Provider value={ context }>
			{ children }
		</wardrobeContext.Provider>
	);
}

export function useWardrobeContext(): Readonly<WardrobeContext> {
	const ctx = useContext(wardrobeContext);
	AssertNotNullable(ctx);
	return ctx;
}

function WardrobeBackgroundColorPicker(): ReactElement {
	const account = useCurrentAccount();
	const directory = useDirectoryConnector();

	const onChange = useEvent((newColor: HexColorString) => {
		directory.sendMessage('changeSettings', { wardrobeBackground: newColor });
	});

	return (
		<ColorInput
			initialValue={ account?.settings.wardrobeBackground ?? `#${DEFAULT_BACKGROUND_COLOR.toString(16)}` }
			onChange={ onChange }
			throttle={ 100 }
			hideTextInput={ true }
			inputColorTitle='Change background color'
		/>
	);
}

function Wardrobe(): ReactElement | null {
	const { target } = useWardrobeContext();

	if (target.type === 'room') {
		return <WardrobeRoom room={ target } />;
	} else if (target.type === 'character') {
		return <WardrobeCharacter character={ target } />;
	}
	AssertNever(target);
}

function WardrobeRoom({ room: _room }: {
	room: IChatRoomContext;
}): ReactElement {
	const navigate = useNavigate();

	return (
		<div className='wardrobe'>
			<div className='wardrobeMain'>
				<TabContainer className='flex-1'>
					<Tab name='Room inventory'>
						<div className='wardrobe-pane'>
							<WardrobeItemManipulation />
						</div>
					</Tab>
					<Tab name='◄ Back' className='slim' onClick={ () => navigate(-1) } />
				</TabContainer>
			</div>
		</div>
	);
}

function WardrobeCharacter({ character }: {
	character: AppearanceContainer;
}): ReactElement {
	const navigate = useNavigate();
	const { globalState } = useWardrobeContext();
	const characterState = globalState.characters.get(character.id);

	if (characterState == null)
		return <Link to='/pandora_lobby'>◄ Back</Link>;

	const inSafemode = characterState.safemode != null;

	return (
		<div className='wardrobe'>
			{
				!inSafemode ? null : (
					<div className='safemode'>
						<CharacterSafemodeWarningContent />
					</div>
				)
			}
			<div className='wardrobeMain'>
				<WardrobeCharacterPreview character={ character } characterState={ characterState } />
				<TabContainer className='flex-1'>
					<Tab name='Items'>
						<div className='wardrobe-pane'>
							<WardrobeItemManipulation />
						</div>
					</Tab>
					<Tab name='Body'>
						<div className='wardrobe-pane'>
							<WardrobeBodyManipulation character={ character } characterState={ characterState } />
						</div>
					</Tab>
					<Tab name='Poses & Expressions'>
						<div className='wardrobe-pane'>
							<div className='wardrobe-ui'>
								<WardrobePoseGui character={ character } characterState={ characterState } />
								<WardrobeExpressionGui character={ character } characterState={ characterState } />
							</div>
						</div>
					</Tab>
					<Tab name='Outfits'>
						<div className='wardrobe-pane'>
							<WardrobeOutfitGui character={ character } />
						</div>
					</Tab>
					<Tab name='◄ Back' className='slim' onClick={ () => navigate(-1) } />
				</TabContainer>
			</div>
		</div>
	);
}

function WardrobeCharacterPreview({ character, characterState }: {
	character: AppearanceContainer;
	characterState: AssetFrameworkCharacterState;
}): ReactElement {
	const shardConnector = useShardConnector();
	const account = useCurrentAccount();

	const sceneOptions = useMemo<GraphicsSceneProps>(() => ({
		background: account ? account.settings.wardrobeBackground : `#${DEFAULT_BACKGROUND_COLOR.toString(16)}`,
	}), [account]);

	const overlay = (
		<div className='overlay'>
			<Button className='slim iconButton'
				title='Toggle character view'
				onClick={ () => {
					shardConnector?.sendMessage('appearanceAction', {
						type: 'setView',
						target: character.id,
						view: characterState.view === 'front' ? 'back' : 'front',
					});
				} }
			>
				↷
			</Button>
			<WardrobeBackgroundColorPicker />
		</div>
	);

	return (
		<GraphicsScene className='characterPreview' divChildren={ overlay } sceneOptions={ sceneOptions }>
			<GraphicsCharacter characterState={ characterState } />
		</GraphicsScene>
	);
}

export function useWardrobeTargetItems(target: WardrobeTarget | null): AppearanceItems {
	const { globalState } = useWardrobeContext();

	const items = useMemo<AppearanceItems | null>(() => {
		if (target == null) {
			return null;
		} else if (target.type === 'character') {
			return globalState.getItems({
				type: 'character',
				characterId: target.id,
			});
		} else if (target.type === 'room') {
			return globalState.getItems({
				type: 'roomInventory',
			});
		}
		AssertNever(target);
	}, [globalState, target]);

	return items ?? EMPTY_ARRAY;
}

export function useWardrobeTargetItem(target: WardrobeTarget | null, itemPath: ItemPath | null | undefined): Item | undefined {
	const items = useWardrobeTargetItems(target);

	return useMemo(() => {
		if (!itemPath)
			return undefined;

		const { container, itemId } = itemPath;

		let current: AppearanceItems = items;
		for (const step of container) {
			const item = current.find((it) => it.id === step.item);
			if (!item)
				return undefined;
			current = item.getModuleItems(step.module);
		}
		return current.find((it) => it.id === itemId);
	}, [items, itemPath]);
}

export function useWardrobeItems(): {
	currentFocus: WardrobeFocus;
	setFocus: React.Dispatch<React.SetStateAction<WardrobeFocus>>;
	preFilter: (item: Item | Asset) => boolean;
	containerContentsFilter: (asset: Asset) => boolean;
} {
	const { target } = useWardrobeContext();

	const [currentFocus, setFocus] = useState<WardrobeFocus>({ container: [], itemId: null });

	const preFilter = useCallback((item: Item | Asset) => {
		const asset = 'asset' in item ? item.asset : item;
		if (target.type === 'room') {
			return (!asset.isType('personal') || asset.definition.bodypart == null) &&
				!asset.isType('roomDeviceWearablePart');
		}
		if (target.type === 'character') {
			return !asset.isType('personal') || (
				asset.definition.bodypart == null &&
				(currentFocus.container.length !== 0 || asset.definition.wearable !== false)
			);
		}
		AssertNever(target);
	}, [target, currentFocus]);

	const containerPath = useMemo(() => SplitContainerPath(currentFocus.container), [currentFocus.container]);
	const containerItem = useWardrobeTargetItem(target, containerPath?.itemPath);
	const containerContentsFilter = useMemo<(asset: Asset) => boolean>(() => {
		const module = containerPath ? containerItem?.modules.get(containerPath.module) : undefined;
		return module?.acceptedContentFilter?.bind(module) ?? (() => true);
	}, [containerPath, containerItem]);

	return {
		currentFocus,
		setFocus,
		preFilter,
		containerContentsFilter,
	};
}

function WardrobeItemManipulation({ className }: { className?: string; }): ReactElement {
	const { globalState, target, assetList } = useWardrobeContext();
	const { currentFocus, setFocus, preFilter, containerContentsFilter } = useWardrobeItems();

	const assetManager = useAssetManager();
	const assetFilterCharacterAttributes = useMemo<string[]>(() => ([...assetManager.attributes.entries()]
		.filter((a) => a[1].useAsWardrobeFilter?.tab === 'item')
		.map((a) => a[0])
	), [assetManager]);

	const assetFilterAttributes: string[] = target.type === 'character' ? assetFilterCharacterAttributes : [];
	const title: string = target.type === 'character' ? 'Currently worn items' : 'Room inventory';
	const isRoomInventory = target.type === 'room' && currentFocus.container.length === 0;

	return (
		<div className={ classNames('wardrobe-ui', className) }>
			<InventoryItemView
				title={ title }
				filter={ preFilter }
				focus={ currentFocus }
				setFocus={ setFocus }
			/>
			<TabContainer className={ classNames('flex-1', WardrobeFocusesItem(currentFocus) && 'hidden') }>
				{
					globalState.room != null && !isRoomInventory ? (
						<Tab name='Room inventory'>
							<RoomInventoryView title='Use items in room inventory' container={ currentFocus.container } />
						</Tab>
					) : null
				}
				<Tab name='Create new item'>
					<InventoryAssetView
						title='Create and use a new item'
						assets={ assetList.filter((asset) => {
							return preFilter(asset) && containerContentsFilter(asset);
						}) }
						attributesFilterOptions={ assetFilterAttributes }
						container={ currentFocus.container }
					/>
				</Tab>
				<Tab name='Recent items'>
					<div className='inventoryView'>
						<div className='center-flex flex-1'>
							TODO
						</div>
					</div>
				</Tab>
				<Tab name='Saved items'>
					<div className='inventoryView'>
						<div className='center-flex flex-1'>
							TODO
						</div>
					</div>
				</Tab>
			</TabContainer>
			{
				WardrobeFocusesItem(currentFocus) &&
				<div className='flex-col flex-1'>
					<WardrobeItemConfigMenu key={ currentFocus.itemId } item={ currentFocus } setFocus={ setFocus } />
				</div>
			}
		</div>
	);
}

function WardrobeBodyManipulation({ className, character, characterState }: {
	className?: string;
	character: AppearanceContainer;
	characterState: AssetFrameworkCharacterState;
}): ReactElement {
	const { assetList } = useWardrobeContext();
	const assetManager = useAssetManager();

	const filter = (item: Item | Asset) => {
		const asset = 'asset' in item ? item.asset : item;
		return asset.isType('personal') && asset.definition.bodypart !== undefined;
	};

	const [selectedItemId, setSelectedItemId] = useState<ItemId | null>(null);
	const currentFocus = useMemo<WardrobeFocus>(() => ({
		container: [],
		itemId: selectedItemId,
	}), [selectedItemId]);

	// Reset selected item each time screen opens
	useLayoutEffect(() => {
		setSelectedItemId(null);
	}, []);

	const setFocus = useCallback((newFocus: WardrobeFocus) => {
		Assert(newFocus.container.length === 0, 'Body cannot have containers');
		setSelectedItemId(newFocus.itemId);
	}, []);

	const bodyFilterAttributes = useMemo<string[]>(() => ([...assetManager.attributes.entries()]
		.filter((a) => a[1].useAsWardrobeFilter?.tab === 'body')
		.map((a) => a[0])
	), [assetManager]);

	return (
		<div className={ classNames('wardrobe-ui', className) }>
			<InventoryItemView title='Currently worn items' filter={ filter } focus={ currentFocus } setFocus={ setFocus } />
			<TabContainer className={ classNames('flex-1', WardrobeFocusesItem(currentFocus) && 'hidden') }>
				<Tab name='Change body parts'>
					<InventoryAssetView
						title='Add a new bodypart'
						assets={ assetList.filter(filter) }
						attributesFilterOptions={ bodyFilterAttributes }
						container={ [] }
					/>
				</Tab>
				<Tab name='Change body size'>
					<WardrobeBodySizeEditor character={ character } characterState={ characterState } />
				</Tab>
			</TabContainer>
			{
				WardrobeFocusesItem(currentFocus) &&
				<div className='flex-col flex-1'>
					<WardrobeItemConfigMenu key={ currentFocus.itemId } item={ currentFocus } setFocus={ setFocus } />
				</div>
			}
		</div>
	);
}

export function InventoryAssetView({ className, title, children, assets, container, attributesFilterOptions }: {
	className?: string;
	title: string;
	children?: ReactNode;
	assets: readonly Asset[];
	container: ItemContainerPath;
	attributesFilterOptions?: string[];
}): ReactElement | null {
	const { targetSelector, extraItemActions } = useWardrobeContext();

	const assetManager = useAssetManager();
	const [listMode, setListMode] = useState(true);
	const [filter, setFilter] = useState('');
	const [attribute, setAttribute] = useReducer((old: string, wantToSet: string) => {
		return wantToSet === old ? '' : wantToSet;
	}, '');

	const flt = filter.toLowerCase().trim().split(/\s+/);
	const filteredAssets = useMemo(() => (
		assets
			// Some assets cannot be manually spawned, so ignore those
			.filter((asset) => asset.canBeSpawned())
			.filter((asset) => flt.every((f) => {
				const attributeDefinition = attribute ? assetManager.getAttributeDefinition(attribute) : undefined;
				return asset.definition.name.toLowerCase().includes(f) &&
					((attribute !== '' && attributesFilterOptions?.includes(attribute)) ?
						(
							asset.staticAttributes.has(attribute) &&
							!attributeDefinition?.useAsWardrobeFilter?.excludeAttributes
								?.some((a) => asset.staticAttributes.has(a))
						) : true
					);
			}))
	), [assetManager, assets, flt, attributesFilterOptions, attribute]);

	useEffect(() => {
		if (attribute !== '' && !attributesFilterOptions?.includes(attribute)) {
			setAttribute('');
		}
	}, [attribute, attributesFilterOptions]);

	const extraItemAction = useCallback<WardrobeContextExtraItemActionComponent>(({ item }) => {
		return (
			<WardrobeActionButton action={ {
				type: 'delete',
				target: targetSelector,
				item,
			} }>
				➖
			</WardrobeActionButton>
		);
	}, [targetSelector]);
	useEffect(() => {
		extraItemActions.value = extraItemActions.value.concat([extraItemAction]);
		return () => {
			extraItemActions.value = extraItemActions.value.filter((a) => a !== extraItemAction);
		};
	}, [extraItemAction, extraItemActions]);

	const filterInput = useRef<HTMLInputElement>(null);

	useEffect(() => {
		// Handler to autofocus search
		const keyPressHandler = (ev: KeyboardEvent) => {
			if (
				filterInput.current &&
				// Only if no other input is selected
				(!document.activeElement || !(document.activeElement instanceof HTMLInputElement)) &&
				// Only if this isn't a special key or key combo
				!ev.ctrlKey &&
				!ev.metaKey &&
				!ev.altKey &&
				ev.key.length === 1
			) {
				filterInput.current.focus();
			}
		};
		window.addEventListener('keypress', keyPressHandler);
		return () => {
			window.removeEventListener('keypress', keyPressHandler);
		};
	}, []);

	// Clear filter when looking from different focus
	useEffect(() => {
		setFilter('');
	}, [container, setFilter]);

	return (
		<div className={ classNames('inventoryView', className) }>
			<div className='toolbar'>
				<span>{ title }</span>
				<input ref={ filterInput }
					type='text'
					placeholder='Filter by name'
					value={ filter }
					onChange={ (e) => setFilter(e.target.value) }
				/>
				<IconButton
					onClick={ () => setListMode(false) }
					theme={ listMode ? 'default' : 'defaultActive' }
					src={ gridIcon }
					alt='Grid view mode'
				/>
				<IconButton
					onClick={ () => setListMode(true) }
					theme={ listMode ? 'defaultActive' : 'default' }
					src={ listIcon }
					alt='List view mode'
				/>
			</div>
			{ attributesFilterOptions == null ? null : (
				<div className='toolbar'>
					{ attributesFilterOptions.map((a) => (
						<AttributeButton
							key={ a }
							attribute={ a }
							theme={ attribute === a ? 'defaultActive' : 'default' }
							onClick={ () => setAttribute(a) }
							slim
						/>
					)) }
				</div>
			) }
			{ children }
			<div className={ listMode ? 'list' : 'grid' }>
				{ filteredAssets.map((a) => <InventoryAssetViewList key={ a.id } asset={ a } container={ container } listMode={ listMode } />) }
			</div>
		</div>
	);
}

export function RoomInventoryView({ title, container }: {
	title: string;
	container: ItemContainerPath;
}): ReactElement | null {
	const { globalState, targetSelector, extraItemActions } = useWardrobeContext();

	const extraItemAction = useCallback<WardrobeContextExtraItemActionComponent>(({ item }) => {
		return (
			<WardrobeActionButton action={ {
				type: 'transfer',
				source: targetSelector,
				item,
				target: { type: 'roomInventory' },
				container: [],
			} }>
				▷
			</WardrobeActionButton>
		);
	}, [targetSelector]);
	useEffect(() => {
		extraItemActions.value = extraItemActions.value.concat([extraItemAction]);
		return () => {
			extraItemActions.value = extraItemActions.value.filter((a) => a !== extraItemAction);
		};
	}, [extraItemAction, extraItemActions]);

	return (
		<div className='inventoryView'>
			{
				globalState.room != null ? (
					<RoomInventoryViewList
						title={ title }
						room={ globalState.room }
						characterContainer={ container }
					/>
				) : (
					<div className='center-flex flex-1'>
						Not in a room
					</div>
				)
			}
		</div>
	);
}

export function RoomInventoryViewList({
	title,
	room,
	characterContainer,
}: {
	title: string;
	room: AssetFrameworkRoomState;
	characterContainer: ItemContainerPath;
}): ReactElement | null {
	const items = room.items;

	return (
		<>
			<div className='toolbar'>
				<span>{ title }</span>
			</div>
			<div className='list'>
				{
					items.map((i) => (
						<RoomInventoryViewListItem key={ i.id }
							room={ room }
							item={ { container: [], itemId: i.id } }
							characterContainer={ characterContainer }
						/>
					))
				}
			</div>
		</>
	);
}

function RoomInventoryViewListItem({ room, item, characterContainer }: {
	room: AssetFrameworkRoomState;
	item: ItemPath;
	characterContainer: ItemContainerPath;
}): ReactElement {
	const inventoryTarget: RoomTargetSelector = {
		type: 'roomInventory',
	};

	const { targetSelector } = useWardrobeContext();
	const inventoryItem = EvalItemPath(room.items, item);

	if (!inventoryItem) {
		return <div className='inventoryViewItem listMode blocked'>[ ERROR: ITEM NOT FOUND ]</div>;
	}

	const asset = inventoryItem.asset;

	return (
		<div tabIndex={ 0 } className='inventoryViewItem listMode static'>
			<div className='itemPreview' />
			<span className='itemName'>{ asset.definition.name }</span>
			<div className='quickActions'>
				<WardrobeActionButton action={ {
					type: 'move',
					target: inventoryTarget,
					item,
					shift: 1,
				} } autohide hideReserveSpace>
					▼
				</WardrobeActionButton>
				<WardrobeActionButton action={ {
					type: 'move',
					target: inventoryTarget,
					item,
					shift: -1,
				} } autohide hideReserveSpace>
					▲
				</WardrobeActionButton>
				<WardrobeActionButton action={ {
					type: 'delete',
					target: inventoryTarget,
					item,
				} }>
					➖
				</WardrobeActionButton>
				<WardrobeActionButton action={ {
					type: 'transfer',
					source: inventoryTarget,
					item,
					target: targetSelector,
					container: characterContainer,
				} }>
					◁
				</WardrobeActionButton>
			</div>
		</div>
	);
}

function AttributeButton({ attribute, ...buttonProps }: {
	attribute: string;
} & Omit<ButtonProps, 'children'>): ReactElement {
	const assetManager = useAssetManager();
	const [buttonRef, setButtonRef] = useState<HTMLButtonElement | null>(null);

	const attributeDefinition = assetManager.getAttributeDefinition(attribute);

	const icon = useGraphicsUrl(attributeDefinition?.icon);

	return (
		<>
			{ icon ? (
				<IconButton ref={ setButtonRef }
					{ ...buttonProps }
					src={ icon }
					alt={ attributeDefinition?.name ?? `[UNKNOWN ATTRIBUTE '${attribute}']` }
				/>
			) : (
				<Button ref={ setButtonRef } { ...buttonProps } className={ classNames(buttonProps.className, 'iconHeightButton') } >
					{ attributeDefinition?.name ?? `[UNKNOWN ATTRIBUTE '${attribute}']` }
				</Button>
			) }
			<HoverElement parent={ buttonRef } className='attribute-description'>
				{ attributeDefinition?.description ?? `[UNKNOWN ATTRIBUTE '${attribute}']` }
			</HoverElement>
		</>
	);
}

function ActionWarning({ check, parent }: { check: AppearanceActionResult; parent: HTMLElement | null; }) {
	const assetManager = useAssetManager();
	const reason = useMemo(() => (check.result === 'success'
		? ''
		: RenderAppearanceActionResult(assetManager, check)
	), [assetManager, check]);

	if (check.result === 'success') {
		return null;
	}

	return (
		<HoverElement parent={ parent } className='action-warning'>
			{
				!reason ? (
					<>
						This action isn't possible.
					</>
				) : (
					<>
						This action isn't possible, because:<br />
						{ reason }
					</>
				)
			}
		</HoverElement>
	);
}

function InventoryAssetViewList({ asset, container, listMode }: { asset: Asset; container: ItemContainerPath; listMode: boolean; }): ReactElement {
	const { targetSelector, execute } = useWardrobeContext();

	const [newItemId, refreshNewItemId] = useReducer(GenerateRandomItemId, undefined, GenerateRandomItemId);

	const action: AppearanceAction = useMemo(() => ({
		type: 'create',
		target: targetSelector,
		itemId: newItemId,
		asset: asset.id,
		container,
	}), [targetSelector, newItemId, asset, container]);

	const check = useStaggeredAppearanceActionResult(action, true);

	const [ref, setRef] = useState<HTMLDivElement | null>(null);
	return (
		<div
			className={ classNames('inventoryViewItem', listMode ? 'listMode' : 'gridMode', check === null ? 'pending' : check.result === 'success' ? 'allowed' : 'blocked') }
			tabIndex={ 0 }
			ref={ setRef }
			onClick={ () => {
				if (check?.result === 'success') {
					execute(action);
					refreshNewItemId();
				}
			} }>
			{
				check != null ? (
					<ActionWarning check={ check } parent={ ref } />
				) : null
			}
			<div className='itemPreview' />
			<span className='itemName'>{ asset.definition.name }</span>
		</div>
	);
}

export function InventoryItemView({
	className,
	title,
	filter,
	focus = { container: [], itemId: null },
	setFocus,
}: {
	className?: string;
	title: string;
	filter?: (item: Item) => boolean;
	focus?: WardrobeFocus;
	setFocus?: (newFocus: WardrobeFocus) => void;
}): ReactElement | null {
	const { target } = useWardrobeContext();
	const appearance = useWardrobeTargetItems(target);

	const [displayedItems, containerModule, containerSteps] = useMemo<[AppearanceItems, IItemModule | undefined, readonly string[]]>(() => {
		let items: AppearanceItems = filter ? appearance.filter(filter) : appearance;
		let container: IItemModule | undefined;
		const steps: string[] = [];
		for (const step of focus.container) {
			const item = items.find((it) => it.id === step.item);
			const module = item?.modules.get(step.module);
			if (!item || !module)
				return [[], undefined, []];
			steps.push(`${item.asset.definition.name} (${module.config.name})`);
			container = module;
			items = item.getModuleItems(step.module);
		}
		return [items, container, steps];
	}, [appearance, filter, focus]);

	const singleItemContainer = containerModule != null && containerModule instanceof ItemModuleLockSlot;
	useEffect(() => {
		if (!singleItemContainer)
			return;
		if (displayedItems.length === 1 && focus.itemId == null) {
			setFocus?.({ ...focus, itemId: displayedItems[0].id });
		} else if (displayedItems.length === 0 && focus.itemId != null) {
			setFocus?.({ ...focus, itemId: null });
		}
	}, [focus, setFocus, singleItemContainer, displayedItems]);

	return (
		<div className={ classNames('inventoryView', className) }>
			<div className='toolbar'>
				{
					focus.container.length > 0 ? (
						<>
							<button className='modeButton' onClick={ () => {
								const prev = SplitContainerPath(focus.container)?.itemPath;
								setFocus?.(prev ?? { container: [], itemId: null });
							} } >
								Close
							</button>
							<div className='center-flex'>
								Viewing contents of: <br />
								{ containerSteps.join(' > ') }
							</div>
						</>
					) :
						<span>{ title }</span>
				}
			</div>
			<div className='list'>
				{
					displayedItems.map((i) => (
						<InventoryItemViewList key={ i.id }
							item={ { container: focus.container, itemId: i.id } }
							selected={ i.id === focus.itemId }
							setFocus={ setFocus }
							singleItemContainer={ singleItemContainer }
						/>
					))
				}
			</div>
		</div>
	);
}

function InventoryItemViewList({ item, selected = false, setFocus, singleItemContainer = false }: {
	item: ItemPath;
	selected?: boolean;
	setFocus?: (newFocus: WardrobeFocus) => void;
	singleItemContainer?: boolean;
}): ReactElement {
	const { targetSelector, target, extraItemActions } = useWardrobeContext();
	const wornItem = useWardrobeTargetItem(target, item);
	const extraActions = useObservable(extraItemActions);

	if (!wornItem) {
		return <div className='inventoryViewItem listMode blocked'>[ ERROR: ITEM NOT FOUND ]</div>;
	}

	const asset = wornItem.asset;

	return (
		<div tabIndex={ 0 } className={ classNames('inventoryViewItem', 'listMode', selected && 'selected', 'allowed') } onClick={ () => {
			if (singleItemContainer)
				return;
			setFocus?.({
				container: item.container,
				itemId: selected ? null : item.itemId,
			});
		} }>
			<div className='itemPreview' />
			<span className='itemName'>{ asset.definition.name }</span>
			<div className='quickActions'>
				{
					singleItemContainer ? null : (
						<>
							<WardrobeActionButton action={ {
								type: 'move',
								target: targetSelector,
								item,
								shift: 1,
							} } autohide hideReserveSpace>
								▼
							</WardrobeActionButton>
							<WardrobeActionButton action={ {
								type: 'move',
								target: targetSelector,
								item,
								shift: -1,
							} } autohide hideReserveSpace>
								▲
							</WardrobeActionButton>
						</>
					)
				}
				{ extraActions.map((Action, i) => <Action key={ i } item={ item } />) }
			</div>
		</div>
	);
}

const calculationQueue: (() => void)[] = [];
const calculationQueueLowPriority: (() => void)[] = [];
const CALCULATION_DELAY = 0;
const CALCULATION_DELAY_LOW_PRIORITY = 50;

function CalculateInQueue(fn: () => void, lowPriority = false): () => void {
	const shouldStart = calculationQueue.length === 0 && calculationQueueLowPriority.length === 0;
	if (lowPriority) {
		calculationQueueLowPriority.push(fn);
	} else {
		calculationQueue.push(fn);
	}

	if (shouldStart) {
		const run = () => {
			const runFn = calculationQueue.shift() ?? calculationQueueLowPriority.shift();
			runFn?.();
			if (calculationQueue.length > 0 || calculationQueueLowPriority.length > 0) {
				setTimeout(run, calculationQueue.length > 0 ? CALCULATION_DELAY : CALCULATION_DELAY_LOW_PRIORITY);
			}
		};
		setTimeout(run, CALCULATION_DELAY);
	}

	return () => {
		if (lowPriority) {
			_.remove(calculationQueueLowPriority, (i) => i === fn);
		} else {
			_.remove(calculationQueue, (i) => i === fn);
		}
	};
}

function useStaggeredAppearanceActionResult(action: AppearanceAction, lowPriority = false): AppearanceActionResult | null {
	const { actions, player, target, globalState } = useWardrobeContext();
	const [result, setResult] = useState<AppearanceActionResult | null>(null);

	const resultAction = useRef<AppearanceAction | null>(null);
	const resultContext = useRef<AppearanceActionContext | null>(null);

	const wantedAction = useRef(action);
	const wantedContext = useRef(actions);

	wantedAction.current = action;
	wantedContext.current = actions;

	useEffect(() => {
		let cancelCalculate: (() => void) | undefined;

		const doCalculate = () => {
			cancelCalculate?.();
			cancelCalculate = CalculateInQueue(() => {
				if (wantedAction.current === action && wantedContext.current === actions) {
					const check = DoAppearanceAction(action, actions, globalState.assetManager, { dryRun: true });
					resultAction.current = action;
					resultContext.current = actions;
					setResult(check);
				}
			}, lowPriority);
		};

		doCalculate();

		return () => {
			cancelCalculate?.();
		};
		// Note, the presence of `globalState` here is more important than just for assetManager
		// Its purpose is to recalculate requirements when the state changes
	}, [action, actions, target, lowPriority, player, globalState]);

	const valid = lowPriority ? (resultAction.current === action && resultContext.current === actions) :
		(resultAction.current?.type === action.type);

	return valid ? result : null;
}
function WardrobeActionButton({
	id,
	className,
	children,
	action,
	autohide = false,
	hideReserveSpace = false,
	showActionBlockedExplanation = true,
	onExecute,
}: CommonProps & {
	action: AppearanceAction;
	/** If the button should hide on certain invalid states */
	autohide?: boolean;
	/** Makes the button hide if it should in a way, that occupied space is preserved */
	hideReserveSpace?: boolean;
	showActionBlockedExplanation?: boolean;
	onExecute?: () => void;
}): ReactElement {
	const { execute } = useWardrobeContext();

	const check = useStaggeredAppearanceActionResult(action);
	const hide = check != null && autohide && AppearanceActionResultShouldHide(check);
	const [ref, setRef] = useState<HTMLButtonElement | null>(null);

	return (
		<button
			id={ id }
			ref={ setRef }
			className={ classNames('wardrobeActionButton', className, check === null ? 'pending' : check.result === 'success' ? 'allowed' : 'blocked', hide ? (hideReserveSpace ? 'invisible' : 'hidden') : null) }
			onClick={ (ev) => {
				ev.stopPropagation();
				if (check?.result === 'success') {
					execute(action);
					onExecute?.();
				}
			} }
		>
			{
				showActionBlockedExplanation && check != null ? (
					<ActionWarning check={ check } parent={ ref } />
				) : null
			}
			{ children }
		</button>
	);
}

export function WardrobeItemConfigMenu({
	item,
	setFocus,
}: {
	item: ItemPath;
	setFocus: (newFocus: WardrobeFocus) => void;
}): ReactElement {
	const { targetSelector, target } = useWardrobeContext();
	const wornItem = useWardrobeTargetItem(target, item);

	const containerPath = SplitContainerPath(item.container);
	const containerItem = useWardrobeTargetItem(target, containerPath?.itemPath);
	const containerModule = containerPath != null ? containerItem?.modules.get(containerPath.module) : undefined;
	const singleItemContainer = containerModule != null && containerModule instanceof ItemModuleLockSlot;
	const isRoomInventory = target.type === 'room' && item.container.length === 0;

	const close = useCallback(() => {
		setFocus({
			container: item.container,
			itemId: null,
		});
	}, [item, setFocus]);

	useEffect(() => {
		if (!wornItem) {
			close();
		}
	}, [wornItem, close]);

	if (!wornItem) {
		return (
			<div className='inventoryView'>
				<div className='toolbar'>
					<span>Editing item: [ ERROR: ITEM NOT FOUND ]</span>
					<button className='modeButton' onClick={ close }>✖️</button>
				</div>
			</div>
		);
	}

	return (
		<div className='inventoryView'>
			<div className='toolbar'>
				<span>Editing item: { wornItem.asset.definition.name }</span>
				{ !singleItemContainer && <button className='modeButton' onClick={ close }>✖️</button> }
			</div>
			<Column overflowX='hidden' overflowY='auto'>
				<Row wrap>
					{
						singleItemContainer ? null : (
							<>
								<WardrobeActionButton action={ {
									type: 'move',
									target: targetSelector,
									item,
									shift: 1,
								} }>
									▼ Wear on top
								</WardrobeActionButton>
								<WardrobeActionButton action={ {
									type: 'move',
									target: targetSelector,
									item,
									shift: -1,
								} }>
									▲ Wear under
								</WardrobeActionButton>
							</>
						)
					}
					<WardrobeActionButton
						action={ {
							type: 'delete',
							target: targetSelector,
							item,
						} }
						onExecute={ close }
					>
						➖ Remove and delete
					</WardrobeActionButton>
					{
						!isRoomInventory ? (
							<WardrobeActionButton
								action={ {
									type: 'transfer',
									source: targetSelector,
									item,
									target: { type: 'roomInventory' },
									container: [],
								} }
								onExecute={ close }
							>
								<span>
									<u>▽</u> Store in room
								</span>
							</WardrobeActionButton>
						) : null
					}
				</Row>
				{
					(wornItem.isType('personal') || wornItem.isType('roomDevice')) ? (
						<WardrobeItemColorization wornItem={ wornItem } item={ item } />
					) : null
				}
				{
					wornItem.isType('roomDevice') ? (
						<WardrobeRoomDeviceDeployment roomDevice={ wornItem } item={ item } />
					) : null
				}
				{
					wornItem.isType('roomDevice') ? (
						<WardrobeRoomDeviceSlots roomDevice={ wornItem } item={ item } />
					) : null
				}
				{
					wornItem.isType('roomDeviceWearablePart') ? (
						<WardrobeRoomDeviceWearable roomDeviceWearable={ wornItem } item={ item } />
					) : null
				}
				{
					Array.from(wornItem.modules.entries())
						.map(([moduleName, m]) => (
							<FieldsetToggle legend={ `Module: ${m.config.name}` } key={ moduleName }>
								<WardrobeModuleConfig item={ item } moduleName={ moduleName } m={ m } setFocus={ setFocus } />
							</FieldsetToggle>
						))
				}
			</Column>
		</div>
	);
}

function WardrobeItemColorization({ wornItem, item }: {
	wornItem: Item<'personal' | 'roomDevice'>;
	item: ItemPath;
}): ReactElement | null {
	const { target, targetSelector } = useWardrobeContext();
	const allItems = useWardrobeTargetItems(target);
	const action: Omit<AppearanceAction & { type: 'color'; }, 'color'> = useMemo(() => ({
		type: 'color',
		target: targetSelector,
		item,
	}), [targetSelector, item]);
	const overrides = useMemo(() => wornItem.getColorOverrides(allItems) ?? {}, [wornItem, allItems]);

	if (!wornItem.asset.definition.colorization)
		return null;

	return (
		<FieldsetToggle legend='Coloring'>
			{
				Object.entries(wornItem.asset.definition.colorization).map(([colorPartKey, colorPart]) => (
					<WardrobeColorInput
						key={ colorPartKey }
						colorKey={ colorPartKey }
						colorDefinition={ colorPart }
						allItems={ allItems }
						overrideGroup={ overrides[colorPartKey] }
						item={ wornItem }
						action={ action } />
				))
			}
		</FieldsetToggle>
	);
}

function WardrobeColorInput({ colorKey, colorDefinition, allItems, overrideGroup, action, item }: {
	colorKey: string;
	colorDefinition: Immutable<AssetColorization>;
	action: Omit<AppearanceAction & { type: 'color'; }, 'color'>;
	allItems: AppearanceItems;
	overrideGroup?: ColorGroupResult;
	item: Item;
}): ReactElement | null {
	const assetManager = useAssetManager();
	const { actions, execute } = useWardrobeContext();
	const current = useItemColorString(allItems, item, colorKey) ?? colorDefinition.default;
	const bundle = useMemo(() => item.exportColorToBundle(), [item]);
	const disabled = useMemo(() => bundle == null || DoAppearanceAction({ ...action, color: bundle }, actions, assetManager, { dryRun: true }).result !== 'success', [bundle, action, actions, assetManager]);

	if (!colorDefinition.name || !bundle)
		return null;

	return (
		<div className='wardrobeColorRow' key={ colorKey }>
			<span className='flex-1'>{ colorDefinition.name }</span>
			{
				overrideGroup && (
					<span title={ `This color controlled by a color group and inherited from ${overrideGroup.item.asset.definition.name} (${overrideGroup.colorization.name ?? ''}) and cannot be changed.` }>
						🔗
					</span>
				)
			}
			<ColorInputRGBA
				initialValue={ current }
				resetValue={ colorDefinition.default }
				throttle={ 100 }
				disabled={ disabled || !!overrideGroup }
				onChange={ (color) => {
					const newColor = _.cloneDeep<Writeable<typeof bundle>>(bundle);
					newColor[colorKey] = color;
					execute({
						...action,
						color: newColor,
					});
				} }
				minAlpha={ colorDefinition.minAlpha }
				title={ colorDefinition.name }
			/>
		</div>
	);
}

interface WardrobeModuleProps<Module extends IItemModule> {
	item: ItemPath;
	moduleName: string;
	m: Module;
	setFocus: (newFocus: WardrobeFocus) => void;
}

function WardrobeModuleConfig({ m, ...props }: WardrobeModuleProps<IItemModule>): ReactElement {
	if (m instanceof ItemModuleTyped) {
		return <WardrobeModuleConfigTyped { ...props } m={ m } />;
	}
	if (m instanceof ItemModuleStorage) {
		return <WardrobeModuleConfigStorage { ...props } m={ m } />;
	}
	if (m instanceof ItemModuleLockSlot) {
		return <WardrobeModuleConfigLockSlot { ...props } m={ m } />;
	}
	return <>[ ERROR: UNKNOWN MODULE TYPE ]</>;
}

function WardrobeModuleConfigTyped({ item, moduleName, m }: WardrobeModuleProps<ItemModuleTyped>): ReactElement {
	const { targetSelector } = useWardrobeContext();
	const now = useCurrentTime();

	const customText = useMemo(() => {
		if (!m.activeVariant.customText) {
			return null;
		}
		const substitutes = {
			CHARACTER_NAME: m.data.selectedBy?.name ?? '[unknown]',
			CHARACTER_ID: m.data.selectedBy?.id ?? '[unknown id]',
			CHARACTER: m.data.selectedBy ? `${m.data.selectedBy.name} (${m.data.selectedBy.id})` : '[unknown]',
			TIME_PASSED: m.data.selectedAt ? FormatTimeInterval(now - m.data.selectedAt) : '[unknown time]',
			TIME: m.data.selectedAt ? new Date(m.data.selectedAt).toLocaleString() : '[unknown date]',
		};
		return m.activeVariant.customText
			.map((text) => MessageSubstitute(text, substitutes))
			.map((text, index) => <span key={ index }>{ text }</span>);
	}, [m.activeVariant, m.data, now]);

	const rows = useMemo(() => m.config.variants.map((v) => {
		const isSelected = m.activeVariant.id === v.id;

		return (
			<WardrobeActionButton
				key={ v.id }
				action={ {
					type: 'moduleAction',
					target: targetSelector,
					item,
					module: moduleName,
					action: {
						moduleType: 'typed',
						setVariant: v.id,
					},
				} }
				className={ isSelected ? 'selected' : '' }
				showActionBlockedExplanation={ !isSelected }
			>
				{ v.name }
			</WardrobeActionButton>
		);
	}), [m.activeVariant, m.config, targetSelector, item, moduleName]);

	return (
		<Column>
			<Row wrap>
				{ rows }
			</Row>
			{ customText }
		</Column>
	);
}

function WardrobeModuleConfigStorage({ item, moduleName, m, setFocus }: WardrobeModuleProps<ItemModuleStorage>): ReactElement {
	return (
		<Row wrap>
			<button
				className={ classNames('wardrobeActionButton', 'allowed') }
				onClick={ (ev) => {
					ev.stopPropagation();
					setFocus({
						container: [
							...item.container,
							{
								item: item.itemId,
								module: moduleName,
							},
						],
						itemId: null,
					});
				} }
			>
				Open
			</button>
			<Row alignY='center'>
				Contains { m.getContents().length } items.
			</Row>
		</Row>
	);
}

function WardrobeModuleConfigLockSlot({ item, moduleName, m, setFocus }: WardrobeModuleProps<ItemModuleLockSlot>): ReactElement {
	return (
		<Row wrap>
			<button
				className={ classNames('wardrobeActionButton', 'allowed') }
				onClick={ (ev) => {
					ev.stopPropagation();
					setFocus({
						container: [
							...item.container,
							{
								item: item.itemId,
								module: moduleName,
							},
						],
						itemId: null,
					});
				} }
			>
				<img width='21' height='33' src={
					!m.lock ? emptyLock :
						m.lock.getProperties().blockAddRemove ? closedLock :
							openLock
				} />
			</button>
			<Row alignY='center'>
				{
					m.lock ?
						m.lock.getProperties().blockAddRemove ?
							m.lock.asset.definition.name + ': Locked' :
							m.lock.asset.definition.name + ': Not locked' :
						'No lock'
				}
			</Row>
		</Row>
	);
}

function WardrobeBodySizeEditor({ character, characterState }: {
	character: AppearanceContainer;
	characterState: AssetFrameworkCharacterState;
}): ReactElement {
	const { execute } = useWardrobeContext();
	const currentBones = useCharacterAppearancePose(characterState);

	const setBodyDirect = useCallback(({ bones }: { bones: Record<BoneName, number>; }) => {
		execute({
			type: 'body',
			target: character.id,
			bones,
		});
	}, [execute, character]);

	const setBody = useMemo(() => _.throttle(setBodyDirect, 100), [setBodyDirect]);

	return (
		<div className='inventoryView'>
			<div className='bone-ui'>
				{
					currentBones
						.filter((bone) => bone.definition.type === 'body')
						.map((bone) => (
							<BoneRowElement key={ bone.definition.name } bone={ bone } onChange={ (value) => {
								setBody({
									bones: {
										[bone.definition.name]: value,
									},
								});
							} } />
						))
				}
			</div>
		</div>
	);
}

type AssetsPosePreset = AssetsPosePresets[number]['poses'][number];
type CheckedPosePreset = AssetsPosePreset & {
	active: boolean;
	available: boolean;
};
type CheckedAssetsPosePresets = {
	category: string;
	poses: CheckedPosePreset[];
}[];

function GetFilteredAssetsPosePresets(items: AppearanceItems, bonesStates: readonly BoneState[], { leftArm, rightArm }: CharacterArmsPose, assetManager: AssetManagerClient): {
	poses: CheckedAssetsPosePresets;
	limits: AppearanceLimitTree;
} {
	const presets = assetManager.getPosePresets();
	const limits = AppearanceItemProperties(items).limits;
	const bones = new Map<BoneName, number>(bonesStates.map((bone) => [bone.definition.name, bone.rotation]));

	const isActive = (preset: AssetsPosePreset) => {
		const left = { ...preset.arms, ...preset.leftArm };
		const right = { ...preset.arms, ...preset.rightArm };
		if (left.position != null && left.position !== leftArm.position)
			return false;
		if (right.position != null && right.position !== rightArm.position)
			return false;

		for (const [boneName, value] of Object.entries(preset.bones ?? {})) {
			if (value === undefined)
				continue;

			if (bones.get(boneName) !== value)
				return false;
		}

		return true;
	};

	const poses = presets.map<CheckedAssetsPosePresets[number]>((preset) => ({
		category: preset.category,
		poses: preset.poses.map((pose) => {
			const available = limits.validate(pose);
			return {
				...pose,
				active: available && isActive(pose),
				available,
			};
		}),
	}));

	return { poses, limits };
}

function WardrobePoseCategoriesInternal({ poses, setPose }: { poses: CheckedAssetsPosePresets; setPose: (pose: AssetsPosePreset) => void; }): ReactElement {
	return (
		<>
			{ poses.map((poseCategory, poseCategoryIndex) => (
				<React.Fragment key={ poseCategoryIndex }>
					<h4>{ poseCategory.category }</h4>
					<div className='pose-row'>
						{
							poseCategory.poses.map((pose, poseIndex) => (
								<PoseButton key={ poseIndex } pose={ pose } setPose={ setPose } />
							))
						}
					</div>
				</React.Fragment>
			)) }
		</>
	);
}

export function WardrobePoseCategories({ appearance, bones, armsPose, setPose }: { appearance: CharacterAppearance; bones: readonly BoneState[]; armsPose: CharacterArmsPose; setPose: (pose: Omit<AssetsPosePreset, 'name'>) => void; }): ReactElement {
	const assetManager = useAssetManager();
	const { poses } = useMemo(() => GetFilteredAssetsPosePresets(appearance.getAllItems(), bones, armsPose, assetManager), [appearance, bones, armsPose, assetManager]);
	return (
		<WardrobePoseCategoriesInternal poses={ poses } setPose={ setPose } />
	);
}

function WardrobeArmPoseSection<K extends 'position' | 'fingers'>({
	armsPose,
	limits,
	setPose,
	label,
	arm,
	type,
	checked,
	unchecked,
}: {
	armsPose: CharacterArmsPose;
	label: string;
	setPose: (_: Omit<AssetsPosePreset, 'name'>) => void;
	limits?: AppearanceLimitTree;
	arm: 'leftArm' | 'rightArm' | 'arms';
	type: K;
	checked: AppearanceArmPose[K];
	unchecked: AppearanceArmPose[K];
}): ReactElement {
	const id = useId();

	const currentlyChecked = arm !== 'arms'
		? armsPose[arm][type] === checked
		: armsPose.leftArm[type] === checked && armsPose.rightArm[type] === checked;

	return (
		<div>
			<label htmlFor={ `pose-selection-${id}` }>{ label }</label>
			<input
				id={ `pose-selection-${id}` }
				type='checkbox'
				checked={ currentlyChecked }
				disabled={ limits != null && !limits.validate({ [arm]: { [type]: currentlyChecked ? unchecked : checked } }) }
				onChange={ (e) => {
					setPose({
						[arm]: { [type]: e.target.checked ? checked : unchecked },
					});
				} }
			/>
		</div>
	);
}

export function WardrobeArmPoses({ setPose, armsPose, limits }: {
	armsPose: CharacterArmsPose;
	limits?: AppearanceLimitTree;
	setPose: (_: Omit<AssetsPosePreset, 'name'>) => void;
}): ReactElement {
	const ArmToggle = useCallback(({ arm, title }: { arm: 'leftArm' | 'rightArm' | 'arms'; title: string; }): ReactElement => (
		<WardrobeArmPoseSection
			armsPose={ armsPose }
			limits={ limits }
			setPose={ setPose }
			label={ title }
			arm={ arm }
			type='position'
			checked='front'
			unchecked='back'
		/>
	), [armsPose, limits, setPose]);
	const FingersToggle = useCallback(({ arm, title }: { arm: 'leftArm' | 'rightArm' | 'arms'; title: string; }): ReactElement => (
		<WardrobeArmPoseSection
			armsPose={ armsPose }
			limits={ limits }
			setPose={ setPose }
			label={ title }
			arm={ arm }
			type='fingers'
			checked={ 'fist' }
			unchecked={ 'spread' }
		/>
	), [armsPose, limits, setPose]);
	const HandRotation = useCallback(({ arm, title }: { arm: 'leftArm' | 'rightArm'; title: string; }): ReactElement => {
		return (
			<div>
				<label htmlFor={ `pose-hand-rotation-${arm}` }>{ title }</label>
				<Select value={ armsPose[arm].rotation } onChange={ (e) => {
					setPose({
						[arm]: {
							rotation: ArmRotationSchema.parse(e.target.value),
						},
					});
				} }>
					{
						ArmRotationSchema.options
							.filter((r) => armsPose[arm].rotation === r || limits == null || limits.validate({ [arm]: { rotation: r } }))
							.map((r) => (
								<option key={ r } value={ r }>{ _.capitalize(r) }</option>
							))
					}
				</Select>
			</div>
		);
	}, [armsPose, limits, setPose]);
	return (
		<>
			<ArmToggle arm='arms' title='Arms are in front of the body' />
			<ArmToggle arm='leftArm' title='Left arm is in front of the body' />
			<ArmToggle arm='rightArm' title='Right arm is in front of the body' />
			<FingersToggle arm='arms' title='Hands are closed into fists' />
			<FingersToggle arm='leftArm' title='Left hand is closed into a fist' />
			<FingersToggle arm='rightArm' title='Right hand is closed into a fist' />
			<HandRotation arm='leftArm' title='Left hand rotation' />
			<HandRotation arm='rightArm' title='Right hand rotation' />
		</>
	);
}

export function WardrobePoseGui({ character, characterState }: {
	character: AppearanceContainer;
	characterState: AssetFrameworkCharacterState;
}): ReactElement {
	const assetManager = useAssetManager();
	const { execute } = useWardrobeContext();

	const currentBones = useCharacterAppearancePose(characterState);
	const armsPose = useCharacterAppearanceArmsPose(characterState);
	const view = useCharacterAppearanceView(characterState);

	const setPoseDirect = useEvent(({ bones, arms, leftArm, rightArm }: Omit<AssetsPosePreset, 'name'>) => {
		execute({
			type: 'pose',
			target: character.id,
			bones,
			leftArm: { ...arms, ...leftArm },
			rightArm: { ...arms, ...rightArm },
		});
	});

	const { poses, limits } = useMemo(() => GetFilteredAssetsPosePresets(characterState.items, currentBones, armsPose, assetManager), [characterState, currentBones, armsPose, assetManager]);

	const setPose = useMemo(() => _.throttle(setPoseDirect, 100), [setPoseDirect]);

	return (
		<div className='inventoryView'>
			<div className='bone-ui'>
				<div>
					<label htmlFor='back-view-toggle'>Show back view</label>
					<input
						id='back-view-toggle'
						type='checkbox'
						checked={ view === 'back' }
						onChange={ (e) => {
							execute({
								type: 'setView',
								target: character.id,
								view: e.target.checked ? 'back' : 'front',
							});
						} }
					/>
				</div>
				<WardrobePoseCategoriesInternal poses={ poses } setPose={ setPose } />
				{ USER_DEBUG &&
					<FieldsetToggle legend='[DEV] Manual pose' persistent='bone-ui-dev-pose' open={ false }>
						<WardrobeArmPoses armsPose={ armsPose } limits={ limits } setPose={ setPose } />
						<br />
						{
							currentBones
								.filter((bone) => bone.definition.type === 'pose')
								.map((bone) => (
									<BoneRowElement key={ bone.definition.name } bone={ bone } limits={ limits } onChange={ (value) => {
										setPose({
											bones: {
												[bone.definition.name]: value,
											},
										});
									} } />
								))
						}
					</FieldsetToggle> }
			</div>
		</div>
	);
}

function PoseButton({ pose, setPose }: { pose: CheckedPosePreset; setPose: (pose: AssetsPosePreset) => void; }): ReactElement {
	const { name, available, active } = pose;
	return (
		<Button className={ classNames('slim', { ['pose-unavailable']: !available }) } disabled={ active || !available } onClick={ () => setPose(pose) }>
			{ name }
		</Button>
	);
}

export function GetVisibleBoneName(name: string): string {
	return name
		.replace(/^\w/, (c) => c.toUpperCase())
		.replace(/_r$/, () => ' Right')
		.replace(/_l$/, () => ' Left')
		.replace(/_\w/g, (c) => ' ' + c.charAt(1).toUpperCase());
}

export function BoneRowElement({ bone, onChange, limits }: { bone: BoneState; onChange: (value: number) => void; limits?: AppearanceLimitTree; }): ReactElement {
	const name = useMemo(() => GetVisibleBoneName(bone.definition.name), [bone]);
	const canReset = useMemo(() => limits == null || limits.validate({ bones: { bone: 0 } }), [limits]);

	const onInput = useEvent((event: React.ChangeEvent<HTMLInputElement>) => {
		const value = Math.round(parseFloat(event.target.value));
		if (Number.isInteger(value) && value !== bone.rotation && (limits == null || limits.validate({ bones: { bone: value } }))) {
			onChange(value);
		}
	});

	return (
		<FieldsetToggle legend={ name } persistent={ 'bone-ui-' + bone.definition.name }>
			<div className='bone-rotation'>
				<input type='range' min={ BONE_MIN } max={ BONE_MAX } step='1' value={ bone.rotation } onChange={ onInput } />
				<input type='number' min={ BONE_MIN } max={ BONE_MAX } step='1' value={ bone.rotation } onChange={ onInput } />
				<Button className='slim' onClick={ () => onChange(0) } disabled={ bone.rotation === 0 || !canReset }>
					↺
				</Button>
			</div>
		</FieldsetToggle>
	);
}

export function WardrobeExpressionGui({ characterState }: {
	character: AppearanceContainer;
	characterState: AssetFrameworkCharacterState;
}): ReactElement {
	const appearance = useCharacterAppearanceItems(characterState);

	const setFocus = useCallback(() => {
		Assert(false, 'Expressions cannot focus container!');
	}, []);

	return (
		<div className='inventoryView'>
			<Column overflowX='hidden' overflowY='auto'>
				{
					appearance
						.flatMap((item) => (
							Array.from(item.modules.entries())
								.filter((m) => m[1].config.expression)
								.map(([moduleName, m]) => (
									<FieldsetToggle legend={ m.config.expression } key={ moduleName }>
										<WardrobeModuleConfig
											item={ { container: [], itemId: item.id } }
											moduleName={ moduleName }
											m={ m }
											setFocus={ setFocus }
										/>
									</FieldsetToggle>
								))
						))
				}
			</Column>
		</div>
	);
}

export function WardrobeOutfitGui({ character }: {
	character: AppearanceContainer;
}): ReactElement {
	const playerId = usePlayerId();

	return (
		<div className='inventoryView'>
			<Column overflowX='hidden' overflowY='auto' className='flex-1'>
				<FieldsetToggle legend='Character randomization' open={ false }>
					<h3>
						WARNING: These buttons remove and DELETE ALL ITEMS currently worn!
					</h3>
					<Row>
						{
							character.id === playerId ? (
								<>
									<WardrobeActionButton action={ {
										type: 'randomize',
										kind: 'items',
									} }>
										Randomize clothes
									</WardrobeActionButton>
									<WardrobeActionButton action={ {
										type: 'randomize',
										kind: 'full',
									} }>
										Randomize everything
									</WardrobeActionButton>
								</>
							) : (
								<span>You cannot randomize other characters</span>
							)
						}
					</Row>
				</FieldsetToggle>
				<div className='center-flex flex-1'>
					TODO
				</div>
			</Column>
		</div>
	);
}

function WardrobeRoomDeviceDeployment({ roomDevice, item }: {
	roomDevice: Item<'roomDevice'>;
	item: ItemPath;
}): ReactElement | null {
	const { targetSelector } = useWardrobeContext();

	let contents: ReactElement | undefined;

	if (roomDevice.deployment != null) {
		contents = (
			<>
				<WardrobeActionButton action={ {
					type: 'roomDeviceDeploy',
					target: targetSelector,
					item,
					deployment: null,
				} }>
					Store the device
				</WardrobeActionButton>
				<WardrobeRoomDeviceDeploymentPosition deployment={ roomDevice.deployment } item={ item } />
			</>
		);
	} else {
		contents = (
			<WardrobeActionButton action={ {
				type: 'roomDeviceDeploy',
				target: targetSelector,
				item,
				deployment: {
					x: 0,
					y: 0,
				},
			} }>
				Deploy the device
			</WardrobeActionButton>
		);
	}

	return (
		<FieldsetToggle legend='Deployment'>
			<Column>
				{ contents }
			</Column>
		</FieldsetToggle>
	);
}

function WardrobeRoomDeviceDeploymentPosition({ deployment, item }: {
	deployment: NonNullable<Immutable<RoomDeviceDeployment>>;
	item: ItemPath;
}): ReactElement | null {
	const throttle = 100;

	const { targetSelector, execute } = useWardrobeContext();

	const [positionX, setPositionX] = useUpdatedUserInput(deployment.x, [item]);
	const [positionY, setPositionY] = useUpdatedUserInput(deployment.y, [item]);

	const disabled = useStaggeredAppearanceActionResult({
		type: 'roomDeviceDeploy',
		target: targetSelector,
		item,
		deployment,
	})?.result !== 'success';

	const onChangeCaller = useCallback((newPosition: Immutable<RoomDeviceDeployment>) => {
		execute({
			type: 'roomDeviceDeploy',
			target: targetSelector,
			item,
			deployment: newPosition,
		});
	}, [execute, targetSelector, item]);
	const onChangeCallerThrottled = useMemo(() => throttle <= 0 ? onChangeCaller : _.throttle(onChangeCaller, throttle), [onChangeCaller, throttle]);

	const changeCallback = useCallback((positionChange: Partial<RoomDeviceDeployment>) => {
		const newPosition: Immutable<RoomDeviceDeployment> = {
			...deployment,
			...positionChange,
		};
		setPositionX(newPosition.x);
		setPositionY(newPosition.y);
		onChangeCallerThrottled(newPosition);
	}, [deployment, setPositionX, setPositionY, onChangeCallerThrottled]);

	return (
		<Row alignY='center'>
			<label>X:</label>
			<input type='number'
				value={ positionX }
				onChange={ (ev) => {
					changeCallback({ x: ev.target.valueAsNumber });
				} }
				disabled={ disabled }
			/>
			<label>Y:</label>
			<input type='number'
				value={ positionY }
				onChange={ (ev) => {
					changeCallback({ y: ev.target.valueAsNumber });
				} }
				disabled={ disabled }
			/>
		</Row>
	);
}

function WardrobeRoomDeviceSlots({ roomDevice, item }: {
	roomDevice: Item<'roomDevice'>;
	item: ItemPath;
}): ReactElement | null {
	let contents: ReactNode;

	if (roomDevice.deployment != null) {
		contents = Object.entries(roomDevice.asset.definition.slots).map(([slotName, slotDefinition]) => (
			<WardrobeRoomDeviceSlot key={ slotName }
				item={ item }
				slotName={ slotName }
				slotDefinition={ slotDefinition }
				occupancy={ roomDevice.slotOccupancy.get(slotName) ?? null }
			/>
		));
	} else {
		contents = 'Device must be deployed to interact with slots';
	}

	return (
		<FieldsetToggle legend='Slots'>
			<Column>
				{ contents }
			</Column>
		</FieldsetToggle>
	);
}

function WardrobeRoomDeviceSlot({ slotName, slotDefinition, occupancy, item }: {
	slotName: string;
	slotDefinition: RoomDeviceSlot;
	occupancy: CharacterId | null;
	item: ItemPath;
}): ReactElement | null {
	const { targetSelector, player } = useWardrobeContext();

	const characters: readonly AppearanceContainer[] = useChatRoomCharacters() ?? [player];

	let contents: ReactNode;

	const [selectedCharacter, setSelectedCharacter] = useState<CharacterId>(player.id);

	if (occupancy == null) {
		contents = (
			<>
				<span>Empty</span>
				<Select value={ selectedCharacter } onChange={
					(event) => {
						const characterId = CharacterIdSchema.parse(event.target.value);
						setSelectedCharacter(characterId);
					}
				}>
					{
						characters.map((character) => <option key={ character.id } value={ character.id }>{ character.name } ({ character.id })</option>)
					}
				</Select>
				<WardrobeActionButton action={ {
					type: 'roomDeviceEnter',
					target: targetSelector,
					item,
					slot: slotName,
					character: {
						type: 'character',
						characterId: selectedCharacter,
					},
					itemId: `i/${nanoid()}` as const,
				} }>
					Enter the device
				</WardrobeActionButton>
			</>
		);

	} else {
		const character = characters.find((c) => c.id === occupancy);

		const characterDescriptor = character ? `${character.name} (${character.id})` : `[UNKNOWN] (${occupancy}) [Character not in the room]`;

		contents = (
			<>
				<span>Occupied by { characterDescriptor }</span>
				<WardrobeActionButton action={ {
					type: 'roomDeviceLeave',
					target: targetSelector,
					item,
					slot: slotName,
				} }>
					{ character ? 'Exit the device' : 'Clear occupancy of the slot' }
				</WardrobeActionButton>
			</>
		);
	}

	return (
		<Row alignY='center'>
			<span>{ slotDefinition.name }:</span>
			{ contents }
		</Row>
	);
}

function WardrobeRoomDeviceWearable({ roomDeviceWearable }: {
	roomDeviceWearable: Item<'roomDeviceWearablePart'>;
	item: ItemPath;
}): ReactElement | null {
	let contents: ReactNode;

	if (roomDeviceWearable.roomDeviceLink != null) {
		contents = (
			<WardrobeActionButton action={ {
				type: 'roomDeviceLeave',
				target: { type: 'roomInventory' },
				item: {
					container: [],
					itemId: roomDeviceWearable.roomDeviceLink.device,
				},
				slot: roomDeviceWearable.roomDeviceLink.slot,
			} }>
				Exit the device
			</WardrobeActionButton>
		);
	} else {
		contents = '[ERROR]';
	}

	return (
		<FieldsetToggle legend='Slots'>
			<Column>
				{ contents }
			</Column>
		</FieldsetToggle>
	);
}
