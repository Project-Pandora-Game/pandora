import classNames from 'classnames';
import {
	AssetFrameworkRoomState,
	ItemContainerPath,
	ItemPath,
	ActionTargetSelector,
} from 'pandora-common';
import React, { ReactElement, useCallback, useEffect } from 'react';
import deleteIcon from '../../../assets/icons/delete.svg';
import { EvalItemPath } from 'pandora-common/dist/assets/appearanceHelpers';
import { useItemColorRibbon } from '../../../graphics/graphicsLayer';
import { Scrollbar } from '../../common/scrollbar/scrollbar';
import { WardrobeContextExtraItemActionComponent, WardrobeHeldItem } from '../wardrobeTypes';
import { useWardrobeContext } from '../wardrobeContext';
import { InventoryAssetPreview, WardrobeActionButton } from '../wardrobeComponents';
import { InventoryItemViewDropArea } from './wardrobeItemView';
import { isEqual } from 'lodash';
import { Button } from '../../common/button/button';
import { useNavigate } from 'react-router';

export function RoomInventoryView({ title, container }: {
	title: string;
	container: ItemContainerPath;
}): ReactElement | null {
	const { globalState, targetSelector, extraItemActions, showExtraActionButtons } = useWardrobeContext();

	const extraItemAction = useCallback<WardrobeContextExtraItemActionComponent>(({ item }) => {
		if (!showExtraActionButtons)
			return null;

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
	}, [targetSelector, showExtraActionButtons]);
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
	const { heldItem } = useWardrobeContext();
	const items = room.items;
	const navigate = useNavigate();

	return (
		<>
			<div className='toolbar'>
				<span>{ title }</span>
				<Button className='slim' onClick={ () =>
					navigate('/wardrobe/room-inventory') } >
					Switch to room inventory
				</Button>
			</div>
			<Scrollbar color='dark'>
				<div className='list reverse withDropButtons'>
					{
						heldItem.type !== 'nothing' ? (
							<div className='overlay' />
						) : null
					}
					{
						items.map((i) => (
							<React.Fragment key={ i.id }>
								<div className='overlayDropContainer'>
									{
										heldItem.type !== 'nothing' ? (
											<InventoryItemViewDropArea
												target={ { type: 'roomInventory' } }
												container={ [] }
												insertBefore={ i.id }
											/>
										) : null
									}
								</div>
								<RoomInventoryViewListItem key={ i.id }
									room={ room }
									item={ { container: [], itemId: i.id } }
									characterContainer={ characterContainer }
								/>
							</React.Fragment>
						))
					}
					<div className='overlayDropContainer'>
						{
							heldItem.type !== 'nothing' ? (
								<InventoryItemViewDropArea
									target={ { type: 'roomInventory' } }
									container={ [] }
								/>
							) : null
						}
					</div>
				</div>
			</Scrollbar>
		</>
	);
}

function RoomInventoryViewListItem({ room, item, characterContainer }: {
	room: AssetFrameworkRoomState;
	item: ItemPath;
	characterContainer: ItemContainerPath;
}): ReactElement {
	const inventoryTarget: ActionTargetSelector = {
		type: 'roomInventory',
	};

	const { heldItem, setHeldItem, targetSelector, showExtraActionButtons } = useWardrobeContext();
	const inventoryItem = EvalItemPath(room.items, item);

	const ribbonColor = useItemColorRibbon([], inventoryItem ?? null);

	const heldItemSelector: WardrobeHeldItem = {
		type: 'item',
		target: inventoryTarget,
		path: item,
	};

	// Check if this item is held
	const isHeld = isEqual(heldItem, heldItemSelector);

	if (!inventoryItem) {
		return <div className='inventoryViewItem listMode blocked'>[ ERROR: ITEM NOT FOUND ]</div>;
	}

	const asset = inventoryItem.asset;

	return (
		<div
			tabIndex={ 0 }
			className={ classNames('inventoryViewItem', 'listMode', 'allowed') }
			onClick={ () => {
				setHeldItem(heldItemSelector);
			} }
		>
			{
				ribbonColor ?
					<span
						className='colorRibbon'
						style={ {
							backgroundColor: ribbonColor,
						} }
					/> : null
			}
			<InventoryAssetPreview asset={ asset } small={ true } />
			<span className='itemName'>{ asset.definition.name }</span>
			<div className='quickActions'>
				{ showExtraActionButtons ? (
					<>
						<WardrobeActionButton action={ {
							type: 'delete',
							target: inventoryTarget,
							item,
						} }>
							<img src={ deleteIcon } alt='Delete action' />
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
