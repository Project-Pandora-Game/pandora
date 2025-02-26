import classNames from 'classnames';
import type { Immutable } from 'immer';
import {
	AssertNever,
	Asset,
	Item,
	ItemIdSchema,
	SplitContainerPath,
	type ActionTargetSelector,
} from 'pandora-common';
import { IItemModule } from 'pandora-common/dist/assets/modules/common';
import { ItemModuleLockSlot } from 'pandora-common/dist/assets/modules/lockSlot';
import { ReactElement, useCallback, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { z } from 'zod';
import { useAssetManager } from '../../assets/assetManager';
import { useObservable } from '../../observable';
import { Tab, TabContainer } from '../common/tabs/tabs';
import { WardrobeItemConfigMenu } from './itemDetail/_wardrobeItemDetail';
import { WardrobeTemplateEditMenu } from './templateDetail/_wardrobeTemplateDetail';
import { InventoryAssetView } from './views/wardrobeAssetView';
import { InventoryItemView } from './views/wardrobeItemView';
import { InventoryOutfitView } from './views/wardrobeOutfitView';
import { SecondaryInventoryView } from './views/wardrobeSecondaryInventoryView';
import { useWardrobeContext } from './wardrobeContext';
import { WardrobeFocus } from './wardrobeTypes';
import { WardrobeFocusesItem, useWardrobeTargetItem, useWardrobeTargetItems } from './wardrobeUtils';

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
		if (targetSelector.type === 'roomInventory') {
			return asset.isType('roomDevice') ||
				asset.isType('lock') ||
				asset.isType('personal');
		}
		if (targetSelector.type === 'character') {
			return asset.isType('roomDeviceWearablePart') ||
				(
					asset.isType('lock') &&
					currentFocus.container.length !== 0
				) ||
				(
					asset.isType('personal') &&
					(currentFocus.container.length !== 0 || asset.definition.wearable !== false)
				);
		}
		AssertNever(targetSelector);
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

export const WardrobeDeviceLocationStateSchema = z.object({
	deviceId: ItemIdSchema,
}).passthrough();

export function WardrobeItemManipulation(): ReactElement {
	const { targetSelector, heldItem, setHeldItem, focuser, setScrollToItem } = useWardrobeContext();
	const assetList = useAssetManager().assetList;

	const location = useLocation();
	useEffect(() => {
		const locationState = WardrobeDeviceLocationStateSchema.safeParse(location.state);
		if (locationState.success) {
			const { deviceId } = locationState.data;
			focuser.focus({ container: [], itemId: deviceId }, targetSelector);
			setScrollToItem(deviceId);
			location.state = {};
		}
	}, [focuser, location, setScrollToItem, targetSelector]);
	const currentFocus = useObservable(focuser.current);

	const { preFilter, containerContentsFilter, assetFilterAttributes } = useWardrobeItems(currentFocus);

	const appearance = useWardrobeTargetItems(targetSelector);
	const title = targetSelector.type === 'character' ? 'Currently worn items' : 'Room inventory used';

	const isRoomInventory = targetSelector.type === 'roomInventory' && currentFocus.container.length === 0;
	const roomInventoryTarget = useMemo((): ActionTargetSelector => ({ type: 'roomInventory' }), []);

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
			<TabContainer className={ classNames('flex-1', focusType !== 'nothing' ? 'hidden' : null) }>
				{
					!isRoomInventory ? (
						<Tab name='Room inventory'>
							<SecondaryInventoryView
								title='Use items in room inventory'
								secondaryTarget={ roomInventoryTarget }
								quickActionTarget={ targetSelector }
								quickActionTargetContainer={ currentFocus.container }
							/>
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
				<Tab name='Saved items'>
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
