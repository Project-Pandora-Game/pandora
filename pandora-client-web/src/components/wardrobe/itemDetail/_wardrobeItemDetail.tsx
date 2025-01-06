import classNames from 'classnames';
import {
	EMPTY_ARRAY,
	GetLogger,
	ItemPath,
	LIMIT_ITEM_DESCRIPTION_LENGTH,
	LIMIT_ITEM_NAME_LENGTH,
	LIMIT_ITEM_NAME_PATTERN,
	SplitContainerPath,
	type AppearanceAction,
	type Item,
} from 'pandora-common';
import { ItemModuleLockSlot } from 'pandora-common/dist/assets/modules/lockSlot';
import React, { ReactElement, useCallback, useEffect, useMemo, useRef } from 'react';
import { toast } from 'react-toastify';
import { z } from 'zod';
import crossIcon from '../../../assets/icons/cross.svg';
import deleteIcon from '../../../assets/icons/delete.svg';
import strugglingAllow from '../../../assets/icons/struggling_allow.svg';
import strugglingDeny from '../../../assets/icons/struggling_deny.svg';
import { TextInput } from '../../../common/userInteraction/input/textInput';
import { TOAST_OPTIONS_WARNING } from '../../../persistentToast';
import { Button, IconButton } from '../../common/button/button';
import { Column, Row } from '../../common/container/container';
import { FieldsetToggle } from '../../common/fieldsetToggle';
import { FormCreateStringValidator } from '../../common/form/form';
import { useConfirmDialog } from '../../dialog/dialog';
import { WardrobeModuleConfig } from '../modules/_wardrobeModules';
import { useStaggeredAppearanceActionResult } from '../wardrobeCheckQueue';
import { ActionWarningContent, WardrobeActionButton } from '../wardrobeComponents';
import { useWardrobeContext } from '../wardrobeContext';
import { useWardrobeTargetItem } from '../wardrobeUtils';
import { WardrobeItemColorization } from './wardrobeItemColor';
import { WardrobeItemName } from './wardrobeItemName';
import { WardrobeRoomDeviceDeployment, WardrobeRoomDeviceSlots, WardrobeRoomDeviceWearable } from './wardrobeItemRoomDevice';

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
		focuser.reset();
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
			<div className='inventoryView itemEdit'>
				<div className='toolbar'>
					<span>Editing item: [ ERROR: ITEM NOT FOUND ]</span>
					<IconButton
						onClick={ close }
						theme='default'
						src={ crossIcon }
						alt='Close item details'
					/>
				</div>
			</div>
		);
	}

	return (
		<div className='inventoryView itemEdit'>
			<div className='toolbar'>
				<span>Editing item:&#x20;<WardrobeItemName item={ wornItem } /></span>
				{
					!singleItemContainer ? (
						<IconButton
							onClick={ close }
							theme='default'
							src={ crossIcon }
							alt='Close item details'
						/>
					) : null
				}
			</div>
			<Column padding='medium' overflowX='hidden' overflowY='auto'>
				<Row padding='medium' wrap className='itemActions'>
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
						<WardrobeItemRequireFreeHandsCustomize wornItem={ wornItem } item={ item } />
					) : null
				}
				{
					(wornItem.isType('bodypart') || wornItem.isType('personal') || wornItem.isType('roomDevice')) ? (
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

function WardrobeItemRequireFreeHandsCustomize({ wornItem, item }: { wornItem: Item<'personal' | 'roomDevice'>; item: ItemPath; }): ReactElement {
	const { targetSelector } = useWardrobeContext();

	const actionSetRequired = React.useMemo<AppearanceAction>(() => ({
		type: 'customize',
		target: targetSelector,
		item,
		requireFreeHandsToUse: true,
	}), [targetSelector, item]);
	const actionSetOptional = React.useMemo<AppearanceAction>(() => ({
		type: 'customize',
		target: targetSelector,
		item,
		requireFreeHandsToUse: false,
	}), [targetSelector, item]);

	return (
		<FieldsetToggle legend='Bound usage'>
			<Row alignY='center'>
				<WardrobeActionButton
					action={ actionSetRequired }
					className={ classNames(
						'IconButton',
						wornItem.requireFreeHandsToUse ? 'selected' : '',
					) }
					showActionBlockedExplanation={ !wornItem.requireFreeHandsToUse }
				>
					<img
						src={ strugglingDeny }
						crossOrigin='anonymous'
						alt='Require free hands to use this item'
						title='Require free hands to use this item'
					/>
				</WardrobeActionButton>
				<WardrobeActionButton
					action={ actionSetOptional }
					className={ classNames(
						'IconButton',
						!wornItem.requireFreeHandsToUse ? 'selected' : '',
					) }
					showActionBlockedExplanation={ wornItem.requireFreeHandsToUse }
				>
					<img
						src={ strugglingAllow }
						crossOrigin='anonymous'
						alt='Allow using this item even with blocked hands'
						title='Allow using this item even with blocked hands'
					/>
				</WardrobeActionButton>
			</Row>
		</FieldsetToggle>
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
	const available = checkResult != null && checkResult.valid;

	const onClick = useCallback(() => {
		if (checkResult != null && (!checkResult.valid && checkResult.prompt == null || checkResult.getActionSlowdownTime() > 0)) {
			toast(<ActionWarningContent problems={ !checkResult.valid ? checkResult.problems : EMPTY_ARRAY } prompt={ false } />, TOAST_OPTIONS_WARNING);
			return;
		}
		onStartEdit();
	}, [checkResult, onStartEdit]);

	return (
		<FieldsetToggle legend='Item'>
			<Column className='wardrobeItemCustomizationView'>
				<Row alignY='center'>
					<label htmlFor='original-name'>Original name:</label>
					<span className='name'>{ item.asset.definition.name }</span>
				</Row>
				<Row alignY='center'>
					<label htmlFor='custom-name'>Custom name:</label>
					<span className='name'>{ item.name ?? ' ' }</span>
				</Row>
				<label>Description ({ item.description ? item.description.length : 0 } characters):</label>
				<div className='flex-1 description'>
					{ item.description ?? '' }
				</div>
				<Row>
					<Button onClick={ onClick } className={ available ? '' : 'text-strikethrough' }>Edit</Button>
				</Row>
			</Column>
		</FieldsetToggle>
	);
}

function WardrobeItemNameAndDescriptionEdit({ item, itemPath, onEndEdit }: { item: Item; itemPath: ItemPath; onEndEdit: () => void; }): ReactElement {
	const confirm = useConfirmDialog();
	const { targetSelector } = useWardrobeContext();
	const [name, setName] = React.useState(item.name ?? '');
	const [description, setDescription] = React.useState(item.description ?? '');

	const nameError = React.useMemo(() => (
		FormCreateStringValidator(z.string().max(LIMIT_ITEM_NAME_LENGTH).regex(LIMIT_ITEM_NAME_PATTERN), 'name')(name)
	), [name]);

	const cancelConfirm = useCallback(() => {
		Promise.resolve()
			.then(() => {
				if (name !== (item.name ?? '') || description !== (item.description ?? '')) {
					return confirm('Unsaved changes', <>Are you sure you want to discard your changes?</>);
				}
				return true;
			})
			.then((confirmed) => {
				if (confirmed) {
					onEndEdit();
				}
			})
			.catch((err) => {
				GetLogger('WardrobeItemNameAndDescriptionEdit').error('Error cancelling edit:', err);
			});
	}, [confirm, description, item.description, item.name, name, onEndEdit]);

	const action = useMemo((): AppearanceAction => ({
		type: 'customize',
		target: targetSelector,
		item: itemPath,
		name: name.trim(),
		description: description.trim(),
	}), [description, itemPath, name, targetSelector]);

	return (
		<FieldsetToggle legend='Item'>
			<Column className='wardrobeItemCustomizationView'>
				<Row alignY='center'>
					<label htmlFor='original-name'>Original name:</label>
					<TextInput id='original-name' value={ item.asset.definition.name } readOnly />
				</Row>
				<Row alignY='center'>
					<label htmlFor='custom-name'>Custom name:</label>
					<TextInput id='custom-name' value={ name } onChange={ setName } maxLength={ LIMIT_ITEM_NAME_LENGTH } />
				</Row>
				{
					nameError && (
						<Row>
							<span className='error'>{ nameError }</span>
						</Row>
					)
				}
				<label htmlFor='custom-description'>Description ({ description.length }/{ LIMIT_ITEM_DESCRIPTION_LENGTH } characters):</label>
				<textarea id='custom-description' className='description' value={ description } rows={ 10 } onChange={ (e) => setDescription(e.target.value) } maxLength={ LIMIT_ITEM_DESCRIPTION_LENGTH } />
				<Row alignX='space-between'>
					<Button onClick={ cancelConfirm }>Cancel</Button>
					<WardrobeActionButton
						action={ action }
						disabled={ !!nameError }
						className='standardButtonSize'
					>
						Save
					</WardrobeActionButton>
				</Row>
			</Column>
		</FieldsetToggle>
	);
}
