import classNames from 'classnames';
import { isEqual } from 'lodash';
import {
	ActionTargetSelector,
	EMPTY_ARRAY,
	EvalContainerPath,
	EvalItemPath,
	ItemContainerPath,
	ItemPath,
	type AppearanceItems,
} from 'pandora-common';
import React, { ReactElement, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import deleteIcon from '../../../assets/icons/delete.svg';
import { useItemColorRibbon } from '../../../graphics/graphicsLayer';
import { Button } from '../../common/button/button';
import { WardrobeItemName } from '../itemDetail/wardrobeItemName';
import { useWardrobeActionContext } from '../wardrobeActionContext';
import { InventoryAssetPreview, WardrobeActionButton, WardrobeColorRibbon } from '../wardrobeComponents';
import { useWardrobeContext } from '../wardrobeContext';
import { WardrobeContextExtraItemActionComponent, WardrobeHeldItem } from '../wardrobeTypes';
import { InventoryItemViewDropArea } from './wardrobeItemView';

export function SecondaryInventoryView({ title, secondaryTarget, secondaryTargetContainer = EMPTY_ARRAY, quickActionTarget, quickActionTargetContainer }: {
	title: string;
	secondaryTarget: ActionTargetSelector;
	secondaryTargetContainer?: ItemContainerPath;
	quickActionTarget: ActionTargetSelector;
	quickActionTargetContainer: ItemContainerPath;
}): ReactElement | null {
	const { globalState } = useWardrobeActionContext();
	const { extraItemActions, showExtraActionButtons, heldItem } = useWardrobeContext();
	const navigate = useNavigate();

	const extraItemAction = useCallback<WardrobeContextExtraItemActionComponent>(({ target, item }) => {
		if (!showExtraActionButtons)
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
	}, [showExtraActionButtons, secondaryTarget, secondaryTargetContainer]);

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
			<div className='toolbar'>
				<span>{ title }</span>
				{
					secondaryTarget.type === 'roomInventory' ? (
						<Button className='slim' onClick={ () =>
							navigate('/wardrobe/room-inventory') } >
							Switch to room inventory
						</Button>
					) : null
				}
			</div>
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
	const { heldItem, setHeldItem, showExtraActionButtons } = useWardrobeContext();

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
			<span className='itemName'><WardrobeItemName item={ item } /></span>
			<div className='quickActions'>
				{ showExtraActionButtons ? (
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
