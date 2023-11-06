import classNames from 'classnames';
import {
	AssertNever,
	Asset,
	Item,
} from 'pandora-common';
import React, { ReactElement, useCallback, useMemo, useState } from 'react';
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

/** This hook doesn't generate or use a global state and shouldn't be used recursively */
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
	const containerContentsFilter = useMemo<(asset: Asset) => boolean>(() => {
		const module = containerPath ? containerItem?.getModules().get(containerPath.module) : undefined;
		return module?.acceptedContentFilter?.bind(module) ?? (() => true);
	}, [containerPath, containerItem]);

	return {
		currentFocus,
		setFocus,
		preFilter,
		containerContentsFilter,
	};
}

export function WardrobeItemManipulation({ className }: { className?: string; }): ReactElement {
	const { globalState, target, assetList } = useWardrobeContext();
	const { currentFocus, setFocus, preFilter, containerContentsFilter } = useWardrobeItems();

	const assetManager = useAssetManager();
	const assetFilterCharacterAttributes = useMemo<string[]>(() => ([...assetManager.attributes.entries()]
		.filter((a) => a[1].useAsWardrobeFilter?.tab === 'item')
		.map((a) => a[0])
	), [assetManager]);
	const assetFilterRoomAttributes = useMemo<string[]>(() => ([...assetManager.attributes.entries()]
		.filter((a) => a[1].useAsWardrobeFilter?.tab === 'room')
		.map((a) => a[0])
	), [assetManager]);

	const assetFilterAttributes: string[] = target.type === 'character' ? assetFilterCharacterAttributes : assetFilterRoomAttributes;
	const title: string = target.type === 'character' ? 'Currently worn items' : 'Room inventory';
	const isRoomInventory = target.type === 'room' && currentFocus.container.length === 0;

	const appearance = useWardrobeTargetItems(target);
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
