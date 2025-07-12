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
import React, { ReactElement, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import deleteIcon from '../../../assets/icons/delete.svg';
import { useItemColorRibbon } from '../../../graphics/layers/graphicsLayerCommon.tsx';
import { useAccountSettings } from '../../../services/accountLogic/accountManagerHooks.ts';
import { WardrobeItemName } from '../itemDetail/wardrobeItemName.tsx';
import { useWardrobeActionContext } from '../wardrobeActionContext.tsx';
import { InventoryAssetPreview, WardrobeActionButton, WardrobeColorRibbon } from '../wardrobeComponents.tsx';
import { useWardrobeContext } from '../wardrobeContext.tsx';
import { WardrobeContextExtraItemActionComponent, WardrobeHeldItem } from '../wardrobeTypes.ts';
import { InventoryItemViewDropArea } from './wardrobeItemView.tsx';

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
			<div className='Scrollbar'>
				<div className='list reverse withDropButtons'>
					{
						heldItem.type !== 'nothing' ? (
							<div className='overlay' />
						) : null
					}
					{
						displayedItems.map((i) => (
							<React.Fragment key={ i.id }>
								<div className='overlayDropContainer'>
									{
										heldItem.type !== 'nothing' ? (
											<InventoryItemViewDropArea
												target={ secondaryTarget }
												container={ secondaryTargetContainer }
												insertBefore={ i.id }
											/>
										) : null
									}
								</div>
								<RoomInventoryViewListItem key={ i.id }
									target={ secondaryTarget }
									itemPath={ { container: secondaryTargetContainer, itemId: i.id } }
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
									target={ secondaryTarget }
									container={ secondaryTargetContainer }
								/>
							) : null
						}
					</div>
				</div>
			</div>
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

	return (
		<div
			tabIndex={ 0 }
			className={ classNames('inventoryViewItem', 'listMode', 'allowed') }
			onClick={ () => {
				setHeldItem(heldItemSelector);
			} }
		>
			{
				ribbonColor ? <WardrobeColorRibbon ribbonColor={ ribbonColor } /> : null
			}
			<InventoryAssetPreview asset={ asset } small={ true } />
			<WardrobeItemName item={ item } />
			<div className='quickActions'>
				{ wardrobeExtraActionButtons ? (
					<>
						<WardrobeActionButton action={ {
							type: 'delete',
							target,
							item: itemPath,
						} }>
							<img src={ deleteIcon } alt='Delete action' />
						</WardrobeActionButton>
						<WardrobeActionButton action={ {
							type: 'transfer',
							source: target,
							item: itemPath,
							target: quickActionTarget,
							container: quickActionTargetContainer,
						} }>
							◁
						</WardrobeActionButton>
					</>
				) : null }
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
	);
}
