import classNames from 'classnames';
import {
	AssetFrameworkRoomState,
	ItemContainerPath,
	ItemPath,
	RoomTargetSelector,
} from 'pandora-common';
import React, { ReactElement, useCallback, useEffect } from 'react';
import { EvalItemPath } from 'pandora-common/dist/assets/appearanceHelpers';
import { useItemColorRibbon } from '../../../graphics/graphicsLayer';
import { Scrollbar } from '../../common/scrollbar/scrollbar';
import { WardrobeContextExtraItemActionComponent } from '../wardrobeTypes';
import { useWardrobeContext } from '../wardrobeContext';
import { InventoryAssetPreview, WardrobeActionButton } from '../wardrobeComponents';
import { InventoryItemViewDropArea } from './wardrobeItemView';

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

	return (
		<>
			<div className='toolbar'>
				<span>{ title }</span>
			</div>
			<Scrollbar color='dark'>
				<div className='list withDropButtons'>
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
	const inventoryTarget: RoomTargetSelector = {
		type: 'roomInventory',
	};

	const { setHeldItem, targetSelector, showExtraActionButtons } = useWardrobeContext();
	const inventoryItem = EvalItemPath(room.items, item);

	const ribbonColor = useItemColorRibbon([], inventoryItem ?? null);

	if (!inventoryItem) {
		return <div className='inventoryViewItem listMode blocked'>[ ERROR: ITEM NOT FOUND ]</div>;
	}

	const asset = inventoryItem.asset;

	return (
		<div
			tabIndex={ 0 }
			className={ classNames('inventoryViewItem', 'listMode', 'allowed') }
			onClick={ () => {
				setHeldItem({
					type: 'item',
					target: inventoryTarget,
					path: item,
				});
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
			<InventoryAssetPreview asset={ asset } />
			<span className='itemName'>{ asset.definition.name }</span>
			<div className='quickActions'>
				{ showExtraActionButtons ? (
					<>
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
							target: targetSelector,
							container: characterContainer,
						} }>
							◁
						</WardrobeActionButton>
					</>
				) : null }
			</div>
		</div>
	);
}
