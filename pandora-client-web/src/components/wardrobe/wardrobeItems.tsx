import classNames from 'classnames';
import {
	AssertNever,
	Asset,
	Item,
} from 'pandora-common';
import React, { ReactElement, useCallback, useMemo } from 'react';
import { useAssetManager } from '../../assets/assetManager';
import { Tab, TabContainer } from '../common/tabs/tabs';
import { IItemModule } from 'pandora-common/dist/assets/modules/common';
import { ItemModuleLockSlot } from 'pandora-common/dist/assets/modules/lockSlot';
import { SplitContainerPath } from 'pandora-common/dist/assets/appearanceHelpers';
import { WardrobeFocus } from './wardrobeTypes';
import { useWardrobeContext } from './wardrobeContext';
import { WardrobeFocusesItem, useWardrobeTargetItem, useWardrobeTargetItems } from './wardrobeUtils';
import { InventoryAssetView } from './views/wardrobeAssetView';
import { WardrobeItemConfigMenu } from './itemDetail/_wardrobeItemDetail';
import { InventoryItemView } from './views/wardrobeItemView';
import { RoomInventoryView } from './views/wardrobeRoomInventoryView';
import { WardrobeTemplateEditMenu } from './templateDetail/_wardrobeTemplateDetail';
import { InventoryOutfitView } from './views/wardrobeOutfitView';
import { useObservable } from '../../observable';

/** This hook doesn't generate or use a global state and shouldn't be used recursively */
export function useWardrobeItems(currentFocus: WardrobeFocus): {
	preFilter: (item: Item | Asset) => boolean;
	containerContentsFilter: (asset: Asset) => boolean;
	assetFilterAttributes: readonly string[];
} {
	const { target } = useWardrobeContext();
	const assetManager = useAssetManager();

	const preFilter = useCallback((item: Item | Asset) => {
		const asset = 'asset' in item ? item.asset : item;
		if (target.type === 'room') {
			return asset.isType('roomDevice') ||
				asset.isType('lock') ||
				(
					asset.isType('personal') &&
					asset.definition.bodypart == null
				);
		}
		if (target.type === 'character') {
			return asset.isType('roomDeviceWearablePart') ||
				(
					asset.isType('lock') &&
					currentFocus.container.length !== 0
				) ||
				(
					asset.isType('personal') &&
					asset.definition.bodypart == null &&
					(currentFocus.container.length !== 0 || asset.definition.wearable !== false)
				);
		}
		AssertNever(target);
	}, [target, currentFocus]);

	const containerPath = useMemo(() => SplitContainerPath(currentFocus.container), [currentFocus.container]);
	const containerItem = useWardrobeTargetItem(target, containerPath?.itemPath);
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
		if (target.type === 'character') {
			return [...assetManager.attributes.entries()]
				.filter((a) => a[1].useAsWardrobeFilter?.tabs.includes('worn'))
				.map((a) => a[0]);
		}

		return [...assetManager.attributes.entries()]
			.filter((a) => a[1].useAsWardrobeFilter?.tabs.includes('room'))
			.map((a) => a[0]);
	}, [assetManager, containerModule, target]);

	return {
		preFilter,
		containerContentsFilter,
		assetFilterAttributes,
	};
}

export function WardrobeItemManipulation({ className }: { className?: string; }): ReactElement {
	const { globalState, target, assetList, heldItem, setHeldItem, focus } = useWardrobeContext();
	const currentFocus = useObservable(focus);
	const { preFilter, containerContentsFilter, assetFilterAttributes } = useWardrobeItems(currentFocus);

	const appearance = useWardrobeTargetItems(target);
	const title = target.type === 'character' ? 'Currently worn items' : 'Room inventory used';

	const isRoomInventory = target.type === 'room' && currentFocus.container.length === 0;

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
		<div className={ classNames('wardrobe-ui', className) }>
			<InventoryItemView
				title={ title }
				filter={ preFilter }
				focus={ currentFocus }
				setFocus={ (newFocus) => focus.value = newFocus }
			/>
			<TabContainer className={ classNames('flex-1', focusType !== 'nothing' ? 'hidden' : null) }>
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
						spawnStyle={ singleItemContainer ? 'spawn' : 'pickup' }
					/>
				</Tab>
				<Tab name='Recent items'>
					<div className='inventoryView'>
						<div className='center-flex flex-1'>
							TODO
						</div>
					</div>
				</Tab>
				<Tab name='Outfits'>
					<InventoryOutfitView
						targetContainer={ currentFocus.container }
					/>
				</Tab>
			</TabContainer>
			{
				focusType === 'item' && WardrobeFocusesItem(currentFocus) ? (
					<div className='flex-col flex-1'>
						<WardrobeItemConfigMenu
							key={ currentFocus.itemId }
							item={ currentFocus }
							setFocus={ (newFocus) => focus.value = newFocus }
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
