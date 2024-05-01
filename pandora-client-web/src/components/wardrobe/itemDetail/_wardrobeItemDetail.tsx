import {
	ItemPath,
} from 'pandora-common';
import React, { ReactElement, useCallback, useEffect, useRef } from 'react';
import { FieldsetToggle } from '../../common/fieldsetToggle';
import { Column, Row } from '../../common/container/container';
import { ItemModuleLockSlot } from 'pandora-common/dist/assets/modules/lockSlot';
import { SplitContainerPath } from 'pandora-common/dist/assets/appearanceHelpers';
import deleteIcon from '../../../assets/icons/delete.svg';
import { useWardrobeContext } from '../wardrobeContext';
import { useWardrobeTargetItem } from '../wardrobeUtils';
import { WardrobeActionButton } from '../wardrobeComponents';
import { WardrobeItemColorization } from './wardrobeItemColor';
import { WardrobeModuleConfig } from '../modules/_wardrobeModules';
import { WardrobeRoomDeviceDeployment, WardrobeRoomDeviceSlots, WardrobeRoomDeviceWearable } from './wardrobeItemRoomDevice';
import { WardrobeItemName } from './wardrobeItemName';

export function WardrobeItemConfigMenu({
	item,
}: {
	item: ItemPath;
}): ReactElement {
	const { targetSelector, target, focuser } = useWardrobeContext();
	const wornItem = useWardrobeTargetItem(target, item);
	const wornItemRef = useRef(wornItem);

	const containerPath = SplitContainerPath(item.container);
	const containerItem = useWardrobeTargetItem(target, containerPath?.itemPath);
	const containerModule = containerPath != null ? containerItem?.getModules().get(containerPath.module) : undefined;
	const singleItemContainer = containerModule != null && containerModule instanceof ItemModuleLockSlot;
	const isRoomInventory = target.type === 'room' && item.container.length === 0;

	const close = useCallback(() => {
		focuser.previous();
	}, [focuser]);

	useEffect(() => {
		if (wornItemRef.current === wornItem)
			return;

		wornItemRef.current = wornItem;
		if (wornItem)
			return;

		focuser.previous();
	}, [wornItem, focuser]);

	if (!wornItem) {
		return (
			<div className='inventoryView'>
				<div className='toolbar'>
					<span>Editing item: [ ERROR: ITEM NOT FOUND ]</span>
					<button className='modeButton' onClick={ close }>✖️</button>
				</div>
			</div>
		);
	}

	return (
		<div className='inventoryView'>
			<div className='toolbar'>
				<span>Editing item:&nbsp;<WardrobeItemName item={ wornItem } /></span>
				{ !singleItemContainer && <button className='modeButton' onClick={ close }>✖️</button> }
			</div>
			<Column padding='medium' overflowX='hidden' overflowY='auto'>
				<Row padding='medium' wrap>
					{
						singleItemContainer ? null : (
							<>
								<WardrobeActionButton action={ {
									type: 'move',
									target: targetSelector,
									item,
									shift: 1,
								} }>
									▲ Wear on top
								</WardrobeActionButton>
								<WardrobeActionButton action={ {
									type: 'move',
									target: targetSelector,
									item,
									shift: -1,
								} }>
									▼ Wear under
								</WardrobeActionButton>
							</>
						)
					}
					<WardrobeActionButton
						action={ {
							type: 'delete',
							target: targetSelector,
							item,
						} }
						onExecute={ close }
					>
						<img src={ deleteIcon } alt='Delete action' /> Remove and delete
					</WardrobeActionButton>
					{
						!isRoomInventory ? (
							<WardrobeActionButton
								action={ {
									type: 'transfer',
									source: targetSelector,
									item,
									target: { type: 'roomInventory' },
									container: [],
								} }
								onExecute={ close }
							>
								<span>
									<u>▽</u> Store in room
								</span>
							</WardrobeActionButton>
						) : null
					}
				</Row>
				{
					(wornItem.isType('personal') || wornItem.isType('roomDevice')) ? (
						<WardrobeItemColorization wornItem={ wornItem } item={ item } />
					) : null
				}
				{
					wornItem.isType('roomDevice') ? (
						<WardrobeRoomDeviceDeployment roomDevice={ wornItem } item={ item } />
					) : null
				}
				{
					wornItem.isType('roomDevice') ? (
						<WardrobeRoomDeviceSlots roomDevice={ wornItem } item={ item } />
					) : null
				}
				{
					wornItem.isType('roomDeviceWearablePart') ? (
						<WardrobeRoomDeviceWearable roomDeviceWearable={ wornItem } item={ item } />
					) : null
				}
				{
					Array.from(wornItem.getModules().entries())
						.map(([moduleName, m]) => (
							<FieldsetToggle legend={ `Module: ${m.config.name}` } key={ moduleName }>
								<WardrobeModuleConfig item={ item } moduleName={ moduleName } m={ m } />
							</FieldsetToggle>
						))
				}
			</Column>
		</div>
	);
}
