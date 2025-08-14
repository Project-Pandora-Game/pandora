import classNames from 'classnames';
import type { Immutable } from 'immer';
import {
	AssertNever,
	Asset,
	Item,
	SplitContainerPath,
	type ActionRoomSelector,
	type ActionTargetSelector,
} from 'pandora-common';
import { IItemModule } from 'pandora-common/dist/assets/modules/common.js';
import { ItemModuleLockSlot } from 'pandora-common/dist/assets/modules/lockSlot.js';
import { ReactElement, useCallback, useMemo, useState } from 'react';
import { useAssetManager } from '../../assets/assetManager.tsx';
import diskIcon from '../../assets/icons/disk.svg';
import plusIcon from '../../assets/icons/plus.svg';
import profileIcon from '../../assets/icons/profile.svg';
import storageIcon from '../../assets/icons/storage.svg';
import { useObservable } from '../../observable.ts';
import { useNavigatePandora } from '../../routing/navigate.ts';
import { SortSpaceCharacters } from '../../ui/screens/room/roomControls.tsx';
import { useFriendStatus } from '../accountContacts/accountContactContext.ts';
import { Button } from '../common/button/button.tsx';
import { Column } from '../common/container/container.tsx';
import { useSpaceCharacters } from '../gameContext/gameStateContextProvider.tsx';
import { WardrobeItemConfigMenu } from './itemDetail/_wardrobeItemDetail.tsx';
import { WardrobeTemplateEditMenu } from './templateDetail/_wardrobeTemplateDetail.tsx';
import { InventoryAssetView } from './views/wardrobeAssetView.tsx';
import { InventoryItemView } from './views/wardrobeItemView.tsx';
import { InventoryOutfitView } from './views/wardrobeOutfitView.tsx';
import { SecondaryInventoryView } from './views/wardrobeSecondaryInventoryView.tsx';
import { useWardrobeActionContext } from './wardrobeActionContext.tsx';
import { useWardrobeContext } from './wardrobeContext.tsx';
import { ActionTargetToWardrobeUrl } from './wardrobeNavigation.tsx';
import { WardrobeFocus } from './wardrobeTypes.ts';
import { WardrobeFocusesItem, useWardrobeTargetItem, useWardrobeTargetItems } from './wardrobeUtils.ts';

/** This hook doesn't generate or use a global state and shouldn't be used recursively */
export function useWardrobeItems(currentFocus: Immutable<WardrobeFocus>): {
	preFilter: (item: Item | Asset) => boolean;
	containerContentsFilter: (asset: Asset) => boolean;
	assetFilterAttributes: readonly string[];
} {
	const { targetSelector } = useWardrobeContext();
	const assetManager = useAssetManager();

	const preFilter = useCallback((item: Item | Asset) => {
		const asset = 'asset' in item ? item.asset : item;

		// When focused on a character, only display wearable assets
		if (targetSelector.type === 'character' && currentFocus.container.length === 0) {
			return asset.isType('roomDeviceWearablePart') ||
				(asset.isType('personal') && asset.definition.wearable !== false);
		}

		// Otherwise display all non-special assets (not bodyparts or room device wearable parts)
		return asset.isType('roomDevice') ||
			asset.isType('lock') ||
			asset.isType('personal');
	}, [targetSelector, currentFocus]);

	const containerPath = useMemo(() => SplitContainerPath(currentFocus.container), [currentFocus.container]);
	const containerItem = useWardrobeTargetItem(targetSelector, containerPath?.itemPath);
	const containerModule = containerPath ? containerItem?.getModules().get(containerPath.module) : undefined;
	const containerContentsFilter = useMemo<(asset: Asset) => boolean>(() => {
		return containerModule?.acceptedContentFilter?.bind(containerModule) ?? (() => true);
	}, [containerModule]);

	const assetFilterAttributes = useMemo((): readonly string[] => {
		// If target is lock slot, only show locks
		if (containerModule?.type === 'lockSlot') {
			return [...assetManager.attributes.entries()]
				.filter((a) => a[1].useAsWardrobeFilter?.tabs.includes('lockSlot'))
				.map((a) => a[0]);
		}

		// If target is lock slot, only show storable items
		if (containerModule?.type === 'storage') {
			return [...assetManager.attributes.entries()]
				.filter((a) => a[1].useAsWardrobeFilter?.tabs.includes('storage'))
				.map((a) => a[0]);
		}

		// If target is character, show only wearable filters
		if (targetSelector.type === 'character') {
			return [...assetManager.attributes.entries()]
				.filter((a) => a[1].useAsWardrobeFilter?.tabs.includes('worn'))
				.map((a) => a[0]);
		}

		return [...assetManager.attributes.entries()]
			.filter((a) => a[1].useAsWardrobeFilter?.tabs.includes('room'))
			.map((a) => a[0]);
	}, [assetManager, containerModule, targetSelector]);

	return {
		preFilter,
		containerContentsFilter,
		assetFilterAttributes,
	};
}

export function WardrobeItemManipulation(): ReactElement {
	const navigate = useNavigatePandora();
	const { globalState } = useWardrobeActionContext();
	const { targetSelector, currentRoomSelector, heldItem, setHeldItem, focuser } = useWardrobeContext();
	const characters = useSpaceCharacters();
	const assetList = useAssetManager().assetList;

	const currentFocus = useObservable(focuser.current);

	const { preFilter, containerContentsFilter, assetFilterAttributes } = useWardrobeItems(currentFocus);
	const [otherPaneTarget, setOtherPaneTarget] = useState<ActionTargetSelector | 'create' | 'saved' | null>(null);

	const appearance = useWardrobeTargetItems(targetSelector);
	const title = targetSelector.type === 'character' ? 'Currently worn items' : 'Room inventory used';

	const singleItemContainer = useMemo<boolean>(() => {
		let items = appearance;
		let container: IItemModule | undefined;
		for (const step of currentFocus.container) {
			const item = items.find((it) => it.id === step.item);
			const module = item?.getModules().get(step.module);
			if (!item || !module)
				return false;
			container = module;
			items = item.getModuleItems(step.module);
		}
		return container != null && container instanceof ItemModuleLockSlot;
	}, [appearance, currentFocus]);

	const focusType = WardrobeFocusesItem(currentFocus) ? 'item' :
		heldItem.type === 'template' ? 'template' :
		'nothing';

	return (
		<div className='wardrobe-ui'>
			<InventoryItemView
				title={ title }
				filter={ preFilter }
			/>
			<Column className={ classNames('flex-1', focusType !== 'nothing' ? 'hidden' : null) }>
				{
					otherPaneTarget == null ? (
						<TargetSelectionPane
							currentRoomSelector={ currentRoomSelector }
							onSelect={ setOtherPaneTarget }
						/>
					) : otherPaneTarget === 'create' ? (
						<InventoryAssetView
							header={ (
								<div className='toolbar'>
									<Button onClick={ () => {
										setOtherPaneTarget(null);
									} }>
										◄ Back
									</Button>
									<span>Create and use a new item</span>
								</div>
							) }
							assets={ assetList.filter((asset) => {
								return preFilter(asset) && containerContentsFilter(asset);
							}) }
							attributesFilterOptions={ assetFilterAttributes }
							container={ currentFocus.container }
							spawnStyle={ singleItemContainer ? 'spawn' : 'pickup' }
						/>
					) : otherPaneTarget === 'saved' ? (
						<InventoryOutfitView
							header={ (
								<div className='toolbar'>
									<Button onClick={ () => {
										setOtherPaneTarget(null);
									} }>
										◄ Back
									</Button>
									<span>Saved items</span>
								</div>
							) }
							targetContainer={ currentFocus.container }
						/>
					) : (
						<SecondaryInventoryView
							header={ (
								<div className='toolbar'>
									<Button onClick={ () => {
										setOtherPaneTarget(null);
									} }>
										◄ Back
									</Button>
									<span>
										{ (
											otherPaneTarget.type === 'room' ? (otherPaneTarget.roomId === currentRoomSelector.roomId ? 'Current room\'s inventory' : `Room inventory (${ globalState.space.getRoom(otherPaneTarget.roomId)?.displayName ?? '[unknown room]' })`) :
											otherPaneTarget.type === 'character' ? `${ characters.find((c) => c.id === otherPaneTarget.characterId)?.name ?? '[unknown]' } (${otherPaneTarget.characterId})` :
											AssertNever(otherPaneTarget)
										) }
									</span>
									<Button className='slim' onClick={ () => navigate(ActionTargetToWardrobeUrl(otherPaneTarget)) } >
										Switch to {
											otherPaneTarget.type === 'room' ? 'room inventory' :
											otherPaneTarget.type === 'character' ? 'this character' :
											AssertNever(otherPaneTarget)
										}
									</Button>
								</div>
							) }
							secondaryTarget={ otherPaneTarget }
							quickActionTarget={ targetSelector }
							quickActionTargetContainer={ currentFocus.container }
						/>
					)
				}
			</Column>
			{
				focusType === 'item' && WardrobeFocusesItem(currentFocus) ? (
					<div className='flex-col flex-1'>
						<WardrobeItemConfigMenu
							key={ currentFocus.itemId }
							item={ currentFocus }
						/>
					</div>
				) :
				focusType === 'template' && heldItem.type === 'template' ? (
					<div className='flex-col flex-1'>
						<WardrobeTemplateEditMenu
							title='Creating item'
							template={ heldItem.template }
							cancelText='✖️ Cancel'
							cancel={ () => setHeldItem({ type: 'nothing' }) }
							updateTemplate={ (newTemplate) => setHeldItem({ type: 'template', template: newTemplate }) }
						/>
					</div>
				) :
				null
			}
		</div>
	);
}

function TargetSelectionPane({ onSelect, currentRoomSelector }: {
	onSelect: (target: ActionTargetSelector | 'create' | 'saved') => void;
	currentRoomSelector: ActionRoomSelector;
}): ReactElement {
	const { globalState } = useWardrobeActionContext();
	const characters = useSpaceCharacters();
	const friends = useFriendStatus();
	const sortedCharacters = useMemo(() => SortSpaceCharacters(characters, friends), [characters, friends]);

	const [showExtra, setShowExtra] = useState<'rooms' | 'characters' | null>(null);

	return (
		<Column className='inventoryViewGhost' alignX='center' alignY='center' padding='medium' overflowY='auto'>
			<Column>
				<Button
					className='align-start'
					onClick={ () => {
						onSelect(currentRoomSelector);
					} }
				>
					<img src={ storageIcon } />Current room's inventory
				</Button>
				<Button
					className='align-start'
					onClick={ () => {
						onSelect('create');
					} }
				>
					<img src={ plusIcon } />Create new item
				</Button>
				<Button
					className='align-start'
					onClick={ () => {
						onSelect('saved');
					} }
				>
					<img src={ diskIcon } />Saved items
				</Button>
				<Button
					theme={ showExtra === 'characters' ? 'defaultActive' : 'default' }
					className='align-start'
					onClick={ () => {
						setShowExtra((v) => v === 'characters' ? null : 'characters');
					} }
				>
					<img src={ profileIcon } />A character
				</Button>
				{ globalState.space.rooms.length > 1 ? (
					<Button
						theme={ showExtra === 'rooms' ? 'defaultActive' : 'default' }
						className='align-start'
						onClick={ () => {
							setShowExtra((v) => v === 'rooms' ? null : 'rooms');
						} }
					>
						<img src={ storageIcon } />Another room's inventory
					</Button>
				) : null }
				<Column
					className={ classNames(
						'WardrobeCollapsableSection',
						showExtra === 'characters' ? 'open' : null,
					) }
					inert={ showExtra !== 'characters' }
				>
					<hr className='fill-x' />
					{
						sortedCharacters
							.map((c) => (
								<Button
									key={ c.id }
									className='align-start'
									onClick={ () => {
										onSelect({
											type: 'character',
											characterId: c.id,
										});
									} }
								>
									<span style={ { color: c.data.publicSettings.labelColor || 'inherit' } }>{ c.name }</span> ({ c.id })  { c.isPlayer() ? '[You]' : '' }
								</Button>
							))
					}
				</Column>
				<Column
					className={ classNames(
						'WardrobeCollapsableSection',
						showExtra === 'rooms' ? 'open' : null,
					) }
					inert={ showExtra !== 'rooms' }
				>
					<hr className='fill-x' />
					{
						globalState.space.rooms
							.filter((r) => r.id !== currentRoomSelector.roomId)
							.map((r) => (
								<Button
									key={ r.id }
									className='align-start'
									onClick={ () => {
										onSelect({
											type: 'room',
											roomId: r.id,
										});
									} }
								>
									{ r.name || r.id }
								</Button>
							))
					}
				</Column>
			</Column>
		</Column>
	);
}

