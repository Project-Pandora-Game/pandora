import classNames from 'classnames';
import { nanoid } from 'nanoid';
import {
	CharacterAppearance,
	AppearanceAction,
	AppearanceActionContext,
	AppearanceItems,
	ArmsPose,
	AssertNotNullable,
	Asset,
	AssetsPosePresets,
	BoneName,
	BoneState,
	BONE_MAX,
	BONE_MIN,
	CharacterView,
	DoAppearanceAction,
	IsCharacterId,
	IsObject,
	Item,
	ItemId,
	ItemContainerPath,
	RoomTargetSelector,
	ItemPath,
	Assert,
	AppearanceActionResult,
	Writeable,
	FormatTimeInterval,
	MessageSubstitute,
	AppearanceItemProperties,
	AppearanceLimitTree,
	CharacterArmsPose,
	AppearanceArmPose,
	ArmRotationSchema,
} from 'pandora-common';
import React, { createContext, ReactElement, ReactNode, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AssetManagerClient, useAssetManager } from '../../assets/assetManager';
import { AppearanceContainer, Character, useCharacterAppearanceArmsPose, useCharacterAppearanceItem, useCharacterAppearanceItems, useCharacterAppearancePose, useCharacterAppearanceView, useCharacterSafemode } from '../../character/character';
import { Observable, useObservable } from '../../observable';
import './wardrobe.scss';
import { useShardConnector } from '../gameContext/shardConnectorContextProvider';
import { ChatRoom, useActionRoomContext, useChatroom, useChatRoomCharacters, useChatRoomData, useRoomInventoryItem, useRoomInventoryItems } from '../gameContext/chatRoomContextProvider';
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
import { GraphicsScene } from '../../graphics/graphicsScene';
import { GraphicsCharacter } from '../../graphics/graphicsCharacter';
import { ColorInput } from '../common/colorInput/colorInput';
import { Column, Row } from '../common/container/container';
import { ItemModuleStorage } from 'pandora-common/dist/assets/modules/storage';
import { ItemModuleLockSlot } from 'pandora-common/dist/assets/modules/lockSlot';
import { SplitContainerPath } from 'pandora-common/dist/assets/appearanceHelpers';
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

export function WardrobeScreen(): ReactElement | null {
	const locationState = useLocation().state as unknown;
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

export type WardrobeContextExtraItemActionComponent = (props: { item: ItemPath; }) => ReactElement;

export interface WardrobeContext {
	character: AppearanceContainer;
	player: AppearanceContainer;
	room: ChatRoom | null;
	target: RoomTargetSelector;
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

export function WardrobeContextProvider({ character, player, children }: { character: Character; player: PlayerCharacter; children: ReactNode; }): ReactElement {
	const assetList = useAssetManager().assetList;
	const room = useChatroom();
	const isInRoom = useChatRoomData() != null;
	const roomContext = useActionRoomContext();
	const shardConnector = useShardConnector();

	const extraItemActions = useMemo(() => new Observable<readonly WardrobeContextExtraItemActionComponent[]>([]), []);

	const actions = useMemo<AppearanceActionContext>(() => ({
		player: player.data.id,
		getCharacter: (id) => {
			if (id === player.data.id) {
				return player.getRestrictionManager(roomContext);
			} else if (id === character.data.id) {
				return character.getRestrictionManager(roomContext);
			}
			return null;
		},
		getTarget: (target) => {
			if (target.type === 'character') {
				if (target.characterId === player.data.id) {
					return player.appearance;
				} else if (target.characterId === character.data.id) {
					return character.appearance;
				}
			}
			if (target.type === 'roomInventory') {
				return isInRoom ? (room?.inventory ?? null) : null;
			}
			return null;
		},
	}), [character, player, roomContext, isInRoom, room]);

	const context = useMemo<WardrobeContext>(() => ({
		character,
		player,
		room,
		target: {
			type: 'character',
			characterId: character.data.id,
		},
		assetList,
		extraItemActions,
		actions,
		execute: (action) => shardConnector?.sendMessage('appearanceAction', action),
	}), [character, assetList, actions, player, shardConnector, extraItemActions, room]);

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

function Wardrobe(): ReactElement | null {
	const { character } = useWardrobeContext();
	const shardConnector = useShardConnector();
	const navigate = useNavigate();

	const inSafemode = useCharacterSafemode(character) != null;

	const overlay = (
		<div className='overlay'>
			<Button className='slim iconButton'
				title='Toggle character view'
				onClick={ () => {
					shardConnector?.sendMessage('appearanceAction', {
						type: 'setView',
						target: character.id,
						view: character.appearance.getView() === CharacterView.FRONT ? CharacterView.BACK : CharacterView.FRONT,
					});
				} }
			>
				↷
			</Button>
		</div>
	);

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
				<GraphicsScene className='characterPreview' divChildren={ overlay }>
					<GraphicsCharacter appearanceContainer={ character } />
				</GraphicsScene>
				<TabContainer className='flex-1'>
					<Tab name='Items'>
						<div className='wardrobe-pane'>
							<WardrobeItemManipulation />
						</div>
					</Tab>
					<Tab name='Body'>
						<div className='wardrobe-pane'>
							<WardrobeBodyManipulation />
						</div>
					</Tab>
					<Tab name='Poses & Expressions'>
						<div className='wardrobe-pane'>
							<div className='wardrobe-ui'>
								<WardrobePoseGui />
								<WardrobeExpressionGui />
							</div>
						</div>
					</Tab>
					<Tab name='Outfits'>
						<div className='wardrobe-pane'>
							<WardrobeOutfitGui />
						</div>
					</Tab>
					<Tab name='◄ Back' className='slim' onClick={ () => navigate(-1) } />
				</TabContainer>
			</div>
		</div>
	);
}

export function useWardrobeItems(): {
	currentFocus: WardrobeFocus;
	setFocus: React.Dispatch<React.SetStateAction<WardrobeFocus>>;
	preFilter: (item: Item | Asset) => boolean;
	containerContentsFilter: (asset: Asset) => boolean;
} {
	const { character } = useWardrobeContext();

	const [currentFocus, setFocus] = useState<WardrobeFocus>({ container: [], itemId: null });

	const preFilter = useCallback((item: Item | Asset) => {
		const { definition } = 'asset' in item ? item.asset : item;
		return definition.bodypart === undefined && (currentFocus.container.length !== 0 || definition.wearable !== false);
	}, [currentFocus]);

	const containerPath = useMemo(() => SplitContainerPath(currentFocus.container), [currentFocus.container]);
	const containerItem = useCharacterAppearanceItem(character, containerPath?.itemPath);
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
	const { assetList } = useWardrobeContext();
	const { currentFocus, setFocus, preFilter, containerContentsFilter } = useWardrobeItems();

	const assetManager = useAssetManager();
	const assetFilterAttributes = useMemo<string[]>(() => ([...assetManager.attributes.entries()]
		.filter((a) => a[1].useAsWardrobeFilter?.tab === 'item')
		.map((a) => a[0])
	), [assetManager]);

	return (
		<div className={ classNames('wardrobe-ui', className) }>
			<InventoryItemView
				title='Currently worn items'
				filter={ preFilter }
				focus={ currentFocus }
				setFocus={ setFocus }
			/>
			<TabContainer className={ classNames('flex-1', WardrobeFocusesItem(currentFocus) && 'hidden') }>
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
				<Tab name='Room inventory'>
					<RoomInventoryView title='Use items in room inventory' container={ currentFocus.container } />
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

function WardrobeBodyManipulation({ className }: { className?: string; }): ReactElement {
	const { assetList } = useWardrobeContext();
	const assetManager = useAssetManager();

	const filter = (item: Item | Asset) => {
		const { definition } = 'asset' in item ? item.asset : item;
		return definition.bodypart !== undefined;
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
					<WardrobeBodySizeEditor />
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
	const { target, extraItemActions } = useWardrobeContext();

	const assetManager = useAssetManager();
	const [listMode, setListMode] = useState(true);
	const [filter, setFilter] = useState('');
	const [attribute, setAttribute] = useReducer((old: string, wantToSet: string) => {
		return wantToSet === old ? '' : wantToSet;
	}, '');

	const flt = filter.toLowerCase().trim().split(/\s+/);
	const filteredAssets = useMemo(() => {
		return assets.filter((asset) => flt.every((f) => {
			const attributeDefinition = attribute ? assetManager.getAttributeDefinition(attribute) : undefined;
			return asset.definition.name.toLowerCase().includes(f) &&
				((attribute !== '' && attributesFilterOptions?.includes(attribute)) ?
					(
						asset.staticAttributes.has(attribute) &&
						!attributeDefinition?.useAsWardrobeFilter?.excludeAttributes
							?.some((a) => asset.staticAttributes.has(a))
					) : true
				);
		}));
	}, [assetManager, assets, flt, attributesFilterOptions, attribute]);

	useEffect(() => {
		if (attribute !== '' && !attributesFilterOptions?.includes(attribute)) {
			setAttribute('');
		}
	}, [attribute, attributesFilterOptions]);

	const extraItemAction = useCallback<WardrobeContextExtraItemActionComponent>(({ item }) => {
		return (
			<WardrobeActionButton action={ {
				type: 'delete',
				target,
				item,
			} }>
				➖
			</WardrobeActionButton>
		);
	}, [target]);
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
	const { room, target, extraItemActions } = useWardrobeContext();
	const isInRoom = useChatRoomData() != null;

	const extraItemAction = useCallback<WardrobeContextExtraItemActionComponent>(({ item }) => {
		return (
			<WardrobeActionButton action={ {
				type: 'transfer',
				source: target,
				item,
				target: { type: 'roomInventory' },
				container: [],
			} }>
				▷
			</WardrobeActionButton>
		);
	}, [target]);
	useEffect(() => {
		extraItemActions.value = extraItemActions.value.concat([extraItemAction]);
		return () => {
			extraItemActions.value = extraItemActions.value.filter((a) => a !== extraItemAction);
		};
	}, [extraItemAction, extraItemActions]);

	return (
		<div className='inventoryView'>
			{
				(room && isInRoom) ? (
					<RoomInventoryViewList
						title={ title }
						room={ room }
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
	room: ChatRoom;
	characterContainer: ItemContainerPath;
}): ReactElement | null {
	const items = useRoomInventoryItems(room);

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
	room: ChatRoom;
	item: ItemPath;
	characterContainer: ItemContainerPath;
}): ReactElement {
	const inventoryTarget: RoomTargetSelector = {
		type: 'roomInventory',
	};

	const { target } = useWardrobeContext();
	const inventoryItem = useRoomInventoryItem(room, item);

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
					target,
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
				check.result === 'invalidAction' ? (
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
	const { actions, target, execute } = useWardrobeContext();

	const action: AppearanceAction = useMemo(() => ({
		type: 'create',
		target,
		itemId: `i/${nanoid()}` as const,
		asset: asset.id,
		container,
	}), [target, asset, container]);

	const check = useStaggeredAppearanceActionResult(action, actions, true);

	const [ref, setRef] = useState<HTMLDivElement | null>(null);
	return (
		<div
			className={ classNames('inventoryViewItem', listMode ? 'listMode' : 'gridMode', check === null ? 'pending' : check.result === 'success' ? 'allowed' : 'blocked') }
			tabIndex={ 0 }
			ref={ setRef }
			onClick={ () => {
				if (check?.result === 'success') {
					execute(action);
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
	const { character } = useWardrobeContext();
	const appearance = useCharacterAppearanceItems(character);

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
	const { target, character, extraItemActions } = useWardrobeContext();
	const wornItem = useCharacterAppearanceItem(character, item);
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
								target,
								item,
								shift: 1,
							} } autohide hideReserveSpace>
								▼
							</WardrobeActionButton>
							<WardrobeActionButton action={ {
								type: 'move',
								target,
								item,
								shift: -1,
							} } autohide hideReserveSpace>
								▲
							</WardrobeActionButton>
						</>
					)
				}
				{ /* eslint-disable-next-line @typescript-eslint/naming-convention */ }
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

function useStaggeredAppearanceActionResult(action: AppearanceAction, context: AppearanceActionContext, lowPriority = false): AppearanceActionResult | null {
	const assetManager = useAssetManager();
	const [result, setResult] = useState<AppearanceActionResult | null>(null);

	const wantedAction = useRef(action);
	const wantedContext = useRef(context);

	wantedAction.current = action;
	wantedContext.current = context;

	useEffect(() => {
		return CalculateInQueue(() => {
			if (wantedAction.current === action && wantedContext.current === context) {
				const check = DoAppearanceAction(action, context, assetManager, { dryRun: true });
				setResult(check);
			}
		}, lowPriority);
	}, [action, context, assetManager, lowPriority]);

	return result;
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
	const { actions, execute } = useWardrobeContext();

	const check = useStaggeredAppearanceActionResult(action, actions);
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
	const assetManager = useAssetManager();
	const { target, character, actions, execute } = useWardrobeContext();
	const wornItem = useCharacterAppearanceItem(character, item);

	const containerPath = SplitContainerPath(item.container);
	const containerItem = useCharacterAppearanceItem(character, containerPath?.itemPath);
	const containerModule = containerPath != null ? containerItem?.modules.get(containerPath.module) : undefined;
	const singleItemContainer = containerModule != null && containerModule instanceof ItemModuleLockSlot;

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
									target,
									item,
									shift: 1,
								} }>
									▼ Wear on top
								</WardrobeActionButton>
								<WardrobeActionButton action={ {
									type: 'move',
									target,
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
							target,
							item,
						} }
						onExecute={ close }
					>
						➖ Remove and delete
					</WardrobeActionButton>
					<WardrobeActionButton
						action={ {
							type: 'transfer',
							source: target,
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
				</Row>
				{
					(wornItem.asset.definition.colorization && Object.keys(wornItem.asset.definition.colorization).length > 0) && (
						<FieldsetToggle legend='Coloring'>
							{
								Object.entries(wornItem.asset.definition.colorization).map(([colorPartKey, colorPart]) => (
									<div className='wardrobeColorRow' key={ colorPartKey }>
										<span className='flex-1'>{ colorPart.name }</span>
										<ColorInput
											initialValue={ wornItem.color[colorPartKey] ?? colorPart.default }
											resetValue={ colorPart.default }
											throttle={ 100 }
											disabled={ DoAppearanceAction({ type: 'color', target, item, color: wornItem.color }, actions, assetManager, { dryRun: true }).result !== 'success' }
											onChange={ (color) => {
												const newColor = _.cloneDeep<Writeable<typeof wornItem.color>>(wornItem.color);
												newColor[colorPartKey] = color;
												execute({
													type: 'color',
													target,
													item,
													color: newColor,
												});
											} }
										/>
									</div>
								))
							}
						</FieldsetToggle>
					)
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
	const { target } = useWardrobeContext();
	const now = useCurrentTime();

	const customText = useMemo(() => {
		if (!m.activeVariant.customText) {
			return null;
		}
		const substitutes = {
			// eslint-disable-next-line @typescript-eslint/naming-convention
			CHARACTER_NAME: m.data.selectedBy?.name ?? '[unknown]',
			// eslint-disable-next-line @typescript-eslint/naming-convention
			CHARACTER_ID: m.data.selectedBy?.id ?? '[unknown id]',
			// eslint-disable-next-line @typescript-eslint/naming-convention
			CHARACTER: m.data.selectedBy ? `${m.data.selectedBy.name} (${m.data.selectedBy.id})` : '[unknown]',
			// eslint-disable-next-line @typescript-eslint/naming-convention
			TIME_PASSED: m.data.selectedAt ? FormatTimeInterval(now - m.data.selectedAt) : '[unknown time]',
			// eslint-disable-next-line @typescript-eslint/naming-convention
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
					target,
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
	}), [m.activeVariant, m.config, target, item, moduleName]);

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

function WardrobeBodySizeEditor(): ReactElement {
	const { character, execute } = useWardrobeContext();
	const currentBones = useCharacterAppearancePose(character);

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
	// eslint-disable-next-line @typescript-eslint/naming-convention
	const ArmToggle = useCallback(({ arm, title }: { arm: 'leftArm' | 'rightArm' | 'arms'; title: string; }): ReactElement => (
		<WardrobeArmPoseSection
			armsPose={ armsPose }
			limits={ limits }
			setPose={ setPose }
			label={ title }
			arm={ arm }
			type='position'
			checked={ ArmsPose.FRONT }
			unchecked={ ArmsPose.BACK }
		/>
	), [armsPose, limits, setPose]);
	// eslint-disable-next-line @typescript-eslint/naming-convention
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
	// eslint-disable-next-line @typescript-eslint/naming-convention
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

export function WardrobePoseGui(): ReactElement {
	const assetManager = useAssetManager();
	const { character, execute } = useWardrobeContext();

	const currentBones = useCharacterAppearancePose(character);
	const armsPose = useCharacterAppearanceArmsPose(character);
	const view = useCharacterAppearanceView(character);

	const setPoseDirect = useEvent(({ bones, arms, leftArm, rightArm }: Omit<AssetsPosePreset, 'name'>) => {
		execute({
			type: 'pose',
			target: character.id,
			bones,
			leftArm: { ...arms, ...leftArm },
			rightArm: { ...arms, ...rightArm },
		});
	});

	const { poses, limits } = useMemo(() => GetFilteredAssetsPosePresets(character.appearance.getAllItems(), currentBones, armsPose, assetManager), [character, currentBones, armsPose, assetManager]);

	const setPose = useMemo(() => _.throttle(setPoseDirect, 100), [setPoseDirect]);

	return (
		<div className='inventoryView'>
			<div className='bone-ui'>
				<div>
					<label htmlFor='back-view-toggle'>Show back view</label>
					<input
						id='back-view-toggle'
						type='checkbox'
						checked={ view === CharacterView.BACK }
						onChange={ (e) => {
							execute({
								type: 'setView',
								target: character.id,
								view: e.target.checked ? CharacterView.BACK : CharacterView.FRONT,
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

export function BoneRowElement({ bone, onChange, limits, unlocked }: { bone: BoneState; onChange: (value: number) => void; limits?: AppearanceLimitTree; unlocked?: boolean; }): ReactElement {
	const name = useMemo(() => GetVisibleBoneName(bone.definition.name), [bone]);
	const canReset = useMemo(() => unlocked || limits == null || limits.validate({ bones: { bone: 0 } }), [unlocked, limits]);

	const onInput = useEvent((event: React.ChangeEvent<HTMLInputElement>) => {
		const value = Math.round(parseFloat(event.target.value));
		if (Number.isInteger(value) && value !== bone.rotation && (unlocked || limits == null || limits.validate({ bones: { bone: value } }))) {
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

export function WardrobeExpressionGui(): ReactElement {
	const { character } = useWardrobeContext();
	const appearance = useCharacterAppearanceItems(character);

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

export function WardrobeOutfitGui(): ReactElement {
	const { character } = useWardrobeContext();
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
