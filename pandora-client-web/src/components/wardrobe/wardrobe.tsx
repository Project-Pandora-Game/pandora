import classNames from 'classnames';
import { nanoid } from 'nanoid';
import {
	Appearance,
	AppearanceAction,
	AppearanceActionContext,
	ArmsPose,
	Asset,
	BoneName,
	BoneState,
	CharacterId,
	CharacterView,
	DoAppearanceAction,
	IsCharacterId,
	IsObject,
	Item,
	ItemId,
} from 'pandora-common';
import React, { createContext, ReactElement, ReactNode, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { GetAssetManager } from '../../assets/assetManager';
import { Character, useCharacterAppearanceItems, useCharacterAppearancePose } from '../../character/character';
import { useObservable } from '../../observable';
import './wardrobe.scss';
import { useShardConnector } from '../gameContext/shardConnectorContextProvider';
import { GraphicsScene, useGraphicsSceneCharacter } from '../../graphics/graphicsScene';
import { useChatRoomCharacters } from '../gameContext/chatRoomContextProvider';
import { usePlayer } from '../gameContext/playerContextProvider';
import type { PlayerCharacter } from '../../character/player';
import { Tab, TabContainer } from '../../common/tabs';
import { FieldsetToggle } from '../common/fieldsetToggle';
import { Button } from '../common/Button/Button';
import { USER_DEBUG } from '../../config/Environment';
import { WARDROBE_POSES } from '../../graphics/def';
import _ from 'lodash';
import { CommonProps } from '../../common/reactTypes';

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

const scene = new GraphicsScene();
function Wardrobe(): ReactElement | null {
	const { character } = useWardrobeContext();
	const ref = useGraphicsSceneCharacter<HTMLDivElement>(scene, character);

	return (
		<div className='wardrobe'>
			<div className='characterPreview' ref={ ref } />
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
							<div className='inventoryView'>
								<div className='center-flex flex-1'>
									TODO
								</div>
							</div>
						</div>
					</div>
				</Tab>
				<Tab name='Outfits'>
					<div className='wardrobe-pane'>
						<div className='center-flex flex-1'>
							TODO
						</div>
					</div>
				</Tab>
			</TabContainer>
		</div>
	);
}

function WardrobeItemManipulation({ className }: { className?: string }): ReactElement {
	const { appearance, assetList } = useWardrobeContext();

	const filter = (item: Item | Asset) => {
		const { definition } = 'asset' in item ? item.asset : item;
		return definition.bodypart === undefined;
	};

	const [selectedItemId, setSelectedItemId] = useState<ItemId| null>(null);
	const selectedItem = selectedItemId && appearance.find((i) => i.id === selectedItemId);

	// Reset selected item each time screen opens
	useLayoutEffect(() => {
		setSelectedItemId(null);
	}, []);

	return (
		<div className={ classNames('wardrobe-ui', className) }>
			<InventoryView title='Currently worn items' items={ appearance.filter(filter) } selectItem={ setSelectedItemId } selectedItemId={ selectedItemId } />
			<TabContainer className={ classNames('flex-1', selectedItem && 'hidden') }>
				<Tab name='Create new item'>
					<InventoryView title='Create and use a new item' items={ assetList.filter(filter) } />
				</Tab>
				<Tab name='Room inventory'>
					<div className='inventoryView'>
						<div className='center-flex flex-1'>
							TODO
						</div>
					</div>
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
				selectedItem != null &&
				<div className='flex-col flex-1'>
					<WardrobeItemConfigMenu key={ selectedItem.id } item={ selectedItem } onClose={ () => setSelectedItemId(null) } />
				</div>
			}
		</div>
	);
}

function WardrobeBodyManipulation({ className }: { className?: string }): ReactElement {
	const { appearance, assetList } = useWardrobeContext();

	const filter = (item: Item | Asset) => {
		const { definition } = 'asset' in item ? item.asset : item;
		return definition.bodypart !== undefined;
	};

	const [selectedItemId, setSelectedItemId] = useState<ItemId| null>(null);
	const selectedItem = selectedItemId && appearance.find((i) => i.id === selectedItemId);

	// Reset selected item each time screen opens
	useLayoutEffect(() => {
		setSelectedItemId(null);
	}, []);

	return (
		<div className={ classNames('wardrobe-ui', className) }>
			<InventoryView title='Currently worn items' items={ appearance.filter(filter) } selectItem={ setSelectedItemId } selectedItemId={ selectedItemId } />
			<TabContainer className={ classNames('flex-1', selectedItem && 'hidden') }>
				<Tab name='Change body parts'>
					<InventoryView title='Add a new bodypart' items={ assetList.filter(filter) } />
				</Tab>
				<Tab name='Change body size'>
					<WardrobeBodySizeEditor />
				</Tab>
			</TabContainer>
			{
				selectedItem != null &&
				<div className='flex-col flex-1'>
					<WardrobeItemConfigMenu key={ selectedItem.id } item={ selectedItem } onClose={ () => setSelectedItemId(null) } />
				</div>
			}
		</div>
	);
}

function InventoryView<T extends Readonly<Asset | Item>>({ className, title, items, selectItem, selectedItemId }: {
	className?: string;
	title: string;
	items: readonly T[];
	selectItem?: (item: ItemId | null) => void;
	selectedItemId?: ItemId | null;
}): ReactElement | null {
	const [listMode, setListMode] = useState(true);
	const [filter, setFilter] = useState('');
	const flt = filter.toLowerCase().trim().split(/\s+/);

	const filteredItems = items.filter((item) => flt.every((f) => {
		const { definition } = 'asset' in item ? item.asset : item;
		return definition.name.toLowerCase().includes(f);
	}));

	return (
		<div className={ classNames('inventoryView', className) }>
			<div className='toolbar'>
				<span>{title}</span>
				<input type='text' value={ filter } onChange={ (e) => setFilter(e.target.value) } />
				<button onClick={ () => setListMode(false) } className={ listMode ? '' : 'active' }>Grid</button>
				<button onClick={ () => setListMode(true) } className={ listMode ? 'active' : ''  }>List</button>
			</div>
			<div className={ listMode ? 'list' : 'grid' }>
				{...filteredItems
					.map((i) => i instanceof Item ? <InventoryItemViewList key={ i.id } item={ i } listMode={ listMode } selected={ i.id === selectedItemId } selectItem={ selectItem } /> :
					i instanceof Asset ? <InventoryAssetViewList key={ i.id } asset={ i } listMode={ listMode } /> : null)}
			</div>
		</div>
	);
}

function InventoryAssetViewList({ asset, listMode }: { asset: Asset; listMode: boolean; }): ReactElement {
	const { actions, character } = useWardrobeContext();

	const action: AppearanceAction = {
		type: 'create',
		target: character.data.id,
		itemId: `i/${nanoid()}` as const,
		asset: asset.id,
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
			<span className='itemName'>{asset.definition.name}</span>
		</div>
	);
}

function InventoryItemViewList({ item, listMode, selected=false, selectItem }: { item: Item; listMode: boolean; selected?: boolean; selectItem?: (item: ItemId | null) => void; }): ReactElement {
	const { character } = useWardrobeContext();

	const asset = item.asset;

	return (
		<div className={ classNames('inventoryViewItem', listMode ? 'listMode' : 'gridMode', selected && 'selected', 'allowed') } onClick={ () => {
			selectItem?.(selected ? null : item.id);
		} }>
			<div className='itemPreview' />
			<span className='itemName'>{asset.definition.name}</span>
			{
				listMode &&
				<div className='quickActions'>
					<WardrobeActionButton action={ {
						type: 'move',
						target: character.data.id,
						itemId: item.id,
						shift: 1,
					} }>
						⬇️
					</WardrobeActionButton>
					<WardrobeActionButton action={ {
						type: 'move',
						target: character.data.id,
						itemId: item.id,
						shift: -1,
					} }>
						⬆️
					</WardrobeActionButton>
					<WardrobeActionButton action={ {
						type: 'delete',
						target: character.data.id,
						itemId: item.id,
					} }>
						➖
					</WardrobeActionButton>
				</div>
			}
		</div>
	);
}

function WardrobeActionButton({
	id,
	className,
	children,
	action,
}: CommonProps & {
	action: AppearanceAction;
}): ReactElement {
	const { actions } = useWardrobeContext();
	const shardConnector = useShardConnector();

	const possible = DoAppearanceAction(action, actions, GetAssetManager(), { dryRun: true });

	return (
		<button id={ id }
			className={ classNames('wardrobeActionButton', className, possible ? 'allowed' : 'blocked') }
			onClick={ (ev) => {
				ev.stopPropagation();
				if (shardConnector && possible) {
					shardConnector.sendMessage('appearanceAction', action);
				}
			} }
		>
			{ children }
		</button>
	);
}

function WardrobeItemConfigMenu({
	item,
	onClose,
}: {
	item: Item;
	onClose: () => void;
}): ReactElement {
	const { character } = useWardrobeContext();

	return (
		<div className='inventoryView'>
			<div className='toolbar'>
				<span>Editing item: {item.asset.definition.name}</span>
				<button onClick={ () => onClose() }>✖️</button>
			</div>
			<div className='toolbar flex-row-wrap'>
				<WardrobeActionButton action={ {
					type: 'move',
					target: character.data.id,
					itemId: item.id,
					shift: 1,
				} }>
					⬇️ Wear on top
				</WardrobeActionButton>
				<WardrobeActionButton action={ {
					type: 'move',
					target: character.data.id,
					itemId: item.id,
					shift: -1,
				} }>
					⬆️ Wear under
				</WardrobeActionButton>
				<WardrobeActionButton action={ {
					type: 'delete',
					target: character.data.id,
					itemId: item.id,
				} }>
					➖ Remove and delete
				</WardrobeActionButton>
			</div>
			<div className='center-flex flex-1'>
				TODO
			</div>
		</div>
	);
}

function WardrobeBodySizeEditor(): ReactElement {
	const { character } = useWardrobeContext();
	const shardConnector = useShardConnector();
	const bones = useCharacterAppearancePose(character);

	const setBodyDirect = useCallback(({ pose }: { pose: Record<BoneName, number>; }) => {
		if (shardConnector) {
			shardConnector.sendMessage('appearanceAction', {
				type: 'body',
				target: character.data.id,
				pose,
			});
		}
	}, [shardConnector, character]);

	const setBody = useMemo(() => _.throttle(setBodyDirect, 100), [setBodyDirect]);

	return (
		<div className='inventoryView'>
			<div className='bone-ui'>
				{
					bones
						.filter((bone) => bone.definition.type === 'body')
						.map((bone) => (
							<BoneRowElement key={ bone.definition.name } bone={ bone } onChange={ (value) => {
								setBody({
									pose: {
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

function WardrobePoseGui(): ReactElement {
	const { character } = useWardrobeContext();
	const shardConnector = useShardConnector();

	const bones = useCharacterAppearancePose(character);
	const armsPose = useSyncExternalStore((onChange) => character.on('appearanceUpdate', (change) => {
		if (change.includes('pose')) {
			onChange();
		}
	}), () => character.appearance.getArmsPose());
	const view = useSyncExternalStore((onChange) => character.on('appearanceUpdate', (change) => {
		if (change.includes('pose')) {
			onChange();
		}
	}), () => character.appearance.getView());

	const setPoseDirect = useCallback(({ pose, armsPose: armsPoseSet }: { pose: Record<BoneName, number>; armsPose?: ArmsPose }) => {
		if (shardConnector) {
			shardConnector.sendMessage('appearanceAction', {
				type: 'pose',
				target: character.data.id,
				pose,
				armsPose: armsPoseSet,
			});
		}
	}, [shardConnector, character]);

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
							if (shardConnector) {
								shardConnector.sendMessage('appearanceAction', {
									type: 'setView',
									target: character.data.id,
									view: e.target.checked ? CharacterView.BACK : CharacterView.FRONT,
								});
							}
						} }
					/>
				</div>
				{
					WARDROBE_POSES.map((poseCategory, poseCategoryIndex) => (
						<React.Fragment key={ poseCategoryIndex }>
							<h4>{ poseCategory.category }</h4>
							<div className='pose-row'>
								{
									poseCategory.poses.map((pose, poseIndex) => (
										<Button key={ poseIndex }
											className='slim'
											onClick={ () => {
												setPose(pose);
											} }
										>
											{ pose.name }
										</Button>
									))
								}
							</div>
						</React.Fragment>
					))
				}
				{ USER_DEBUG &&
					<FieldsetToggle legend='[DEV] Manual pose' persistent='bone-ui-dev-pose' open={ false }>
						<div>
							<label htmlFor='arms-front-toggle'>Arms are in front of the body</label>
							<input
								id='arms-front-toggle'
								type='checkbox'
								checked={ armsPose === ArmsPose.FRONT }
								onChange={ (e) => {
									if (shardConnector) {
										setPose({
											pose: {},
											armsPose: e.target.checked ? ArmsPose.FRONT : ArmsPose.BACK,
										});
									}
								} }
							/>
						</div>
						<br />
						{
							bones
								.filter((bone) => bone.definition.type === 'pose')
								.map((bone) => (
									<BoneRowElement key={ bone.definition.name } bone={ bone } onChange={ (value) => {
										setPose({
											pose: {
												[bone.definition.name]: value,
											},
										});
									} } />
								))
						}
					</FieldsetToggle>}
			</div>
		</div>
	);
}

export function BoneRowElement({ bone, onChange }: { bone: BoneState; onChange: (value: number) => void }) {
	const name = bone.definition.name
		.replace(/^\w/, (c) => c.toUpperCase())
		.replace(/_r$/, () => ' Right')
		.replace(/_l$/, () => ' Left')
		.replace(/_\w/g, (c) => ' ' + c.charAt(1).toUpperCase());

	const onInput = (event: React.ChangeEvent<HTMLInputElement>) => {
		const value = Math.round(parseFloat(event.target.value));
		if (Number.isInteger(value)) {
			onChange(value);
		}
	};

	return (
		<FieldsetToggle legend={ name } persistent={ 'bone-ui-' + bone.definition.name }>
			<div className='bone-rotation'>
				<input type='range' min='-180' max='180' step='1' value={ bone.rotation } onChange={ onInput } />
				<input type='number' min='-180' max='180' step='1' value={ bone.rotation } onChange={ onInput } />
				<Button className='slim' onClick={ () => onChange(0) }>↺</Button>
			</div>
		</FieldsetToggle>
	);
}
