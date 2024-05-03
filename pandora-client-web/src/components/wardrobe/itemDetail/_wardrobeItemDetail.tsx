import {
	ItemPath,
	LIMIT_ITEM_DESCRIPTION_LENGTH,
	LIMIT_ITEM_NAME_LENGTH,
	type AppearanceAction,
	type Item,
} from 'pandora-common';
import React, { ReactElement, useCallback, useEffect, useRef } from 'react';
import { FieldsetToggle } from '../../common/fieldsetToggle';
import { Column, Row } from '../../common/container/container';
import { ItemModuleLockSlot } from 'pandora-common/dist/assets/modules/lockSlot';
import { SplitContainerPath } from 'pandora-common/dist/assets/appearanceHelpers';
import deleteIcon from '../../../assets/icons/delete.svg';
import { useWardrobeContext, useWardrobeExecuteCallback } from '../wardrobeContext';
import { useWardrobeTargetItem } from '../wardrobeUtils';
import { WardrobeActionButton } from '../wardrobeComponents';
import { WardrobeItemColorization } from './wardrobeItemColor';
import { WardrobeModuleConfig } from '../modules/_wardrobeModules';
import { WardrobeRoomDeviceDeployment, WardrobeRoomDeviceSlots, WardrobeRoomDeviceWearable } from './wardrobeItemRoomDevice';
import { WardrobeItemName } from './wardrobeItemName';
import { Button } from '../../common/button/button';
import { useEvent } from '../../../common/useEvent';
import { useStaggeredAppearanceActionResult } from '../wardrobeCheckQueue';

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
				{
					(!wornItem.isType('roomDeviceWearablePart')) ? (
						<WardrobeItemNameAndDescription item={ wornItem } itemPath={ item } />
					) : null
				}
			</Column>
		</div>
	);
}

function WardrobeItemNameAndDescription({ item, itemPath }: { item: Item; itemPath: ItemPath; }): ReactElement {
	const [edit, setEdit] = React.useState(false);
	const onStartEdit = React.useCallback(() => setEdit(true), []);
	const onEndEdit = React.useCallback(() => setEdit(false), []);

	if (edit) {
		return <WardrobeItemNameAndDescriptionEdit item={ item } itemPath={ itemPath } onEndEdit={ onEndEdit } />;
	}

	return (
		<WardrobeItemNameAndDescriptionInfo item={ item } itemPath={ itemPath } onStartEdit={ onStartEdit } />
	);
}

function WardrobeItemNameAndDescriptionInfo({ item, itemPath, onStartEdit }: { item: Item; itemPath: ItemPath; onStartEdit: () => void; }): ReactElement {
	const { targetSelector } = useWardrobeContext();
	const action = React.useMemo<AppearanceAction>(() => ({
		type: 'customize',
		target: targetSelector,
		item: itemPath,
		name: item.name ?? '',
		description: item.description ?? '',
	}), [targetSelector, itemPath, item.name, item.description]);
	const checkResult = useStaggeredAppearanceActionResult(action, { immediate: true });
	const available = checkResult != null && checkResult.problems.length === 0;

	return (
		<FieldsetToggle legend='Item'>
			<Column>
				<Row alignY='center'>
					<label htmlFor='original-name'>Original name:</label>
					<input id='original-name' type='text' value={ item.asset.definition.name } readOnly />
				</Row>
				<Row alignY='center'>
					<label htmlFor='custom-name'>Custom name:</label>
					<input id='custom-name' type='text' value={ item.name ?? '' } readOnly />
				</Row>
				<label>Description ({ item.description ? item.description.length : 0 } characters):</label>
				<textarea id='custom-description' value={ item.description ?? '' } rows={ 10 } readOnly />
				{
					available ? (
						<Row>
							<Button onClick={ onStartEdit }>Edit</Button>
						</Row>
					) : null
				}
			</Column>
		</FieldsetToggle>
	);
}

function WardrobeItemNameAndDescriptionEdit({ item, itemPath, onEndEdit }: { item: Item; itemPath: ItemPath; onEndEdit: () => void; }): ReactElement {
	const { targetSelector } = useWardrobeContext();
	const [execute, processing] = useWardrobeExecuteCallback({ onSuccess: onEndEdit });
	const [name, setName] = React.useState(item.name ?? '');
	const [description, setDescription] = React.useState(item.description ?? '');

	const onSave = useEvent(() => {
		execute({
			type: 'customize',
			target: targetSelector,
			item: itemPath,
			name: name.trim(),
			description: description.trim(),
		});
	});

	return (
		<FieldsetToggle legend='Item'>
			<Column>
				<Row alignY='center'>
					<label htmlFor='original-name'>Original name:</label>
					<input id='original-name' type='text' value={ item.asset.definition.name } readOnly />
				</Row>
				<Row alignY='center'>
					<label htmlFor='custom-name'>Custom name:</label>
					<input id='custom-name' type='text' value={ name } onChange={ (e) => setName(e.target.value) } maxLength={ LIMIT_ITEM_NAME_LENGTH } />
				</Row>
				<label htmlFor='custom-description'>Description ({ description.length }/{ LIMIT_ITEM_DESCRIPTION_LENGTH } characters):</label>
				<textarea id='custom-description' value={ description } rows={ 10 } onChange={ (e) => setDescription(e.target.value) } maxLength={ LIMIT_ITEM_DESCRIPTION_LENGTH } />
				<Row>
					<Button onClick={ onEndEdit } disabled={ processing }>Cancel</Button>
					<Button onClick={ onSave } disabled={ processing }>Save</Button>
				</Row>
			</Column>
		</FieldsetToggle>
	);
}
