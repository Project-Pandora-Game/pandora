import classNames from 'classnames';
import { isEqual } from 'lodash-es';
import {
	ActionTargetSelector,
	EMPTY_ARRAY,
	EvalContainerPath,
	EvalItemPath,
	ItemContainerPath,
	ItemPath,
	type AppearanceItems,
} from 'pandora-common';
import React, { ReactElement, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import arrowAllIcon from '../../../assets/icons/arrow_all.svg';
import { useItemColorRibbon } from '../../../graphics/layers/graphicsLayerCommon.tsx';
import { useAccountSettings } from '../../../services/accountLogic/accountManagerHooks.ts';
import { Column } from '../../common/container/container.tsx';
import { WardrobeItemName } from '../itemDetail/wardrobeItemName.tsx';
import { useWardrobeActionContext } from '../wardrobeActionContext.tsx';
import { InventoryAssetPreview, WardrobeActionButton, WardrobeColorRibbon } from '../wardrobeComponents.tsx';
import { useWardrobeContext } from '../wardrobeContext.tsx';
import { WardrobeContextExtraItemActionComponent, WardrobeHeldItem } from '../wardrobeTypes.ts';
import { useWardrobeContainerAccessCheck } from '../wardrobeUtils.ts';
import { InventoryItemViewDropArea, ViewStorageButton } from './wardrobeItemView.tsx';

export function SecondaryInventoryView({ header, secondaryTarget, secondaryTargetContainer = EMPTY_ARRAY, quickActionTarget, quickActionTargetContainer }: {
	header?: ReactNode;
	secondaryTarget: ActionTargetSelector;
	secondaryTargetContainer?: ItemContainerPath;
	quickActionTarget: ActionTargetSelector;
	quickActionTargetContainer: ItemContainerPath;
}): ReactElement | null {
	const { globalState } = useWardrobeActionContext();
	const { extraItemActions, heldItem } = useWardrobeContext();
	const { wardrobeExtraActionButtons } = useAccountSettings();

	const extraItemAction = useCallback<WardrobeContextExtraItemActionComponent>(({ target, item }) => {
		if (!wardrobeExtraActionButtons)
			return null;

		return (
			<WardrobeActionButton action={ {
				type: 'transfer',
				source: target,
				item,
				target: secondaryTarget,
				container: secondaryTargetContainer,
			} }>
				▷
			</WardrobeActionButton>
		);
	}, [wardrobeExtraActionButtons, secondaryTarget, secondaryTargetContainer]);

	useEffect(() => {
		extraItemActions.value = extraItemActions.value.concat([extraItemAction]);
		return () => {
			extraItemActions.value = extraItemActions.value.filter((a) => a !== extraItemAction);
		};
	}, [extraItemAction, extraItemActions]);

	const rootItems = globalState.getItems(secondaryTarget) ?? EMPTY_ARRAY;
	const displayedItems = useMemo((): AppearanceItems => {
		return EvalContainerPath(rootItems, secondaryTargetContainer) ?? EMPTY_ARRAY;
	}, [rootItems, secondaryTargetContainer]);

	return (
		<div className='inventoryView'>
			{ header }
			<Column className='flex-1' overflowX='clip' overflowY='auto'>
				<SecondaryInventoryViewContent
					targetSelector={ secondaryTarget }
					container={ secondaryTargetContainer }
					items={ displayedItems }
					quickActionTarget={ quickActionTarget }
					quickActionTargetContainer={ quickActionTargetContainer }
				>
					{
						heldItem.type !== 'nothing' ? (
							<div className='overlay' />
						) : null
					}
				</SecondaryInventoryViewContent>
			</Column>
		</div>
	);
}

function SecondaryInventoryViewContent({ children, targetSelector, container, items, quickActionTarget, quickActionTargetContainer }: {
	children?: ReactNode;
	targetSelector: ActionTargetSelector;
	container: ItemContainerPath;
	items: AppearanceItems;
	quickActionTarget: ActionTargetSelector;
	quickActionTargetContainer: ItemContainerPath;
}): ReactElement {
	const { heldItem } = useWardrobeContext();

	const containerAccessCheck = useWardrobeContainerAccessCheck(targetSelector, container);

	return containerAccessCheck.valid ? (
		<div className='list reverse withDropButtons'>
			{ children }
			{
				items.map((i) => (
					<React.Fragment key={ i.id }>
						<div className='overlayDropContainer'>
							{
								heldItem.type !== 'nothing' ? (
									<InventoryItemViewDropArea
										target={ targetSelector }
										container={ container }
										insertBefore={ i.id }
									/>
								) : null
							}
						</div>
						<RoomInventoryViewListItem key={ i.id }
							target={ targetSelector }
							itemPath={ { container, itemId: i.id } }
							quickActionTarget={ quickActionTarget }
							quickActionTargetContainer={ quickActionTargetContainer }
						/>
					</React.Fragment>
				))
			}
			<div className='overlayDropContainer'>
				{
					heldItem.type !== 'nothing' ? (
						<InventoryItemViewDropArea
							target={ targetSelector }
							container={ container }
						/>
					) : null
				}
			</div>
		</div>
	) : (
		<div className='flex-1 center-flex'>
			<strong className='wardrobeProblemMessage'>You are not allowed to view the contents of this container.</strong>
		</div>
	);
}

function RoomInventoryViewListItem({ target, itemPath, quickActionTarget, quickActionTargetContainer }: {
	target: ActionTargetSelector;
	itemPath: ItemPath;
	quickActionTarget: ActionTargetSelector;
	quickActionTargetContainer: ItemContainerPath;
}): ReactElement {
	const { globalState } = useWardrobeActionContext();
	const { heldItem, setHeldItem } = useWardrobeContext();
	const { wardrobeExtraActionButtons } = useAccountSettings();
	const [showContent, setShowContent] = useState(false);

	const item = EvalItemPath(globalState.getItems(target) ?? EMPTY_ARRAY, itemPath);
	const ribbonColor = useItemColorRibbon([], item ?? null);

	const heldItemSelector = useMemo((): WardrobeHeldItem => ({
		type: 'item',
		target,
		path: itemPath,
	}), [target, itemPath]);

	// Check if this item is held
	const isHeld = isEqual(heldItem, heldItemSelector);

	if (!item) {
		return <div className='inventoryViewItem listMode blocked'>[ ERROR: ITEM NOT FOUND ]</div>;
	}

	const asset = item.asset;
	const storageModuleName = asset.definition.storageModule;
	const storageModule = storageModuleName != null ? item.getModules().get(storageModuleName) : undefined;

	return (
		<Column gap='none'>
			<div
				tabIndex={ 0 }
				className={ classNames('inventoryViewItem', 'listMode') }
				data-asset-id={ asset.id }
			>
				{
					ribbonColor ? <WardrobeColorRibbon ribbonColor={ ribbonColor } /> : null
				}
				<InventoryAssetPreview asset={ asset } small={ true } />
				<WardrobeItemName item={ item } />
				<div className='quickActions'>
					{ storageModuleName != null && storageModule != null ? (
						<ViewStorageButton
							showContent={ showContent }
							setShowContent={ setShowContent }
							targetSelector={ target }
							container={ [
								...itemPath.container,
								{
									item: itemPath.itemId,
									module: storageModuleName,
								},
							] }
						/>
					) : null }
					{ wardrobeExtraActionButtons ? (
						<WardrobeActionButton action={ {
							type: 'transfer',
							source: target,
							item: itemPath,
							target: quickActionTarget,
							container: quickActionTargetContainer,
						} }>
							◁
						</WardrobeActionButton>
					) : null }
					<button
						className='wardrobeActionButton allowed'
						onClick={ (ev) => {
							ev.stopPropagation();
							setHeldItem(heldItemSelector);
						} }
					>
						<img src={ arrowAllIcon } alt='Quick-action mode' />
					</button>
				</div>
				{
					isHeld ? (
						<div
							className='overlayDrop inventoryViewItem allowed'
							tabIndex={ 0 }
							onClick={ (ev) => {
								ev.preventDefault();
								ev.stopPropagation();
								setHeldItem({ type: 'nothing' });
							} }
						>
							Cancel
						</div>
					) : null
				}
			</div>
			{ storageModuleName != null && storageModule != null && showContent ? (
				<Column className='innerStorageWrapper'>
					<SecondaryInventoryViewContent
						targetSelector={ target }
						container={ [
							...itemPath.container,
							{
								item: itemPath.itemId,
								module: storageModuleName,
							},
						] }
						items={ item.getModuleItems(storageModuleName) }
						quickActionTarget={ quickActionTarget }
						quickActionTargetContainer={ quickActionTargetContainer }
					>
						{
							heldItem.type !== 'nothing' ? (
								<div className='overlay' />
							) : null
						}
					</SecondaryInventoryViewContent>
				</Column>
			) : null }
		</Column>
	);
}
