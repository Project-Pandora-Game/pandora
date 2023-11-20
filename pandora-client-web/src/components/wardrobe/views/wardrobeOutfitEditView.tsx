import React, { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { AssertNever, AssetFrameworkOutfit, CloneDeepMutable, EMPTY_ARRAY, ItemTemplate } from 'pandora-common';
import { Column, Row } from '../../common/container/container';
import { Button } from '../../common/button/button';
import { Scrollbar } from '../../common/scrollbar/scrollbar';
import { useWardrobeContext } from '../wardrobeContext';
import { useAssetManager } from '../../../assets/assetManager';
import { InventoryAssetPreview } from '../wardrobeComponents';
import { toast } from 'react-toastify';
import { TOAST_OPTIONS_ERROR } from '../../../persistentToast';
import { EvalItemPath } from 'pandora-common/dist/assets/appearanceHelpers';
import { clamp, first, noop } from 'lodash';
import { WardrobeContextExtraItemActionComponent } from '../wardrobeTypes';
import { useConfirmDialog } from '../../dialog/dialog';

export function OutfitEditView({ outfit, updateOutfit }: {
	outfit: AssetFrameworkOutfit;
	updateOutfit: (newData: AssetFrameworkOutfit | null) => void;
}): ReactElement {
	const { heldItem, extraItemActions, globalState, targetSelector } = useWardrobeContext();
	const [editName, setEditName] = useState(outfit.name);

	const insertItemTemplate = useCallback((index: number | null, itemTemplate: ItemTemplate) => {
		const newItems = [...outfit.items];
		index ??= newItems.length;
		if (index < 0 || index > newItems.length)
			return;

		newItems.splice(index, 0, itemTemplate);

		updateOutfit({
			...outfit,
			items: newItems,
		});
	}, [outfit, updateOutfit]);

	const reorderItemTemplate = useCallback((index: number, shift: number) => {
		const newItems = [...outfit.items];
		if (index < 0 || index >= newItems.length)
			return;

		const movedItem = newItems.splice(index, 1)[0];
		const newIndex = clamp(index + shift, 0, newItems.length);
		newItems.splice(newIndex, 0, movedItem);

		updateOutfit({
			...outfit,
			items: newItems,
		});
	}, [outfit, updateOutfit]);

	const updateItemTemplate = useCallback((index: number, itemTemplate: ItemTemplate | null) => {
		const newItems = [...outfit.items];
		if (index < 0 || index >= newItems.length)
			return;

		if (itemTemplate != null) {
			newItems[index] = CloneDeepMutable(itemTemplate);
		} else {
			newItems.splice(index, 1);
		}

		updateOutfit({
			...outfit,
			items: newItems,
		});
	}, [outfit, updateOutfit]);

	const extraItemAction = useCallback<WardrobeContextExtraItemActionComponent>(({ item }) => {
		return (
			<button
				className='wardrobeActionButton allowed flex-1'
				onClick={ (ev) => {
					ev.stopPropagation();

					const rootItems = globalState.getItems(targetSelector);
					const actualItem = EvalItemPath(rootItems ?? EMPTY_ARRAY, item);
					if (!actualItem) {
						return;
					}

					insertItemTemplate(null, actualItem.exportToTemplate());
				} }
			>
				💾
			</button>
		);
	}, [globalState, insertItemTemplate, targetSelector]);
	useEffect(() => {
		extraItemActions.value = extraItemActions.value.concat([extraItemAction]);
		return () => {
			extraItemActions.value = extraItemActions.value.filter((a) => a !== extraItemAction);
		};
	}, [extraItemAction, extraItemActions]);

	return (
		<Column className='flex-1' padding='small'>
			<fieldset>
				<legend>Outfit name</legend>
				<Row>
					<input className='flex-1' value={ editName } onChange={ (e) => setEditName(e.target.value) } />
					<Button
						className='slim fadeDisabled'
						onClick={ () => updateOutfit({
							...outfit,
							name: editName,
						}) }
						disabled={ outfit.name === editName }
					>
						Save
					</Button>
				</Row>
			</fieldset>
			<fieldset className='flex-1'>
				<legend>Items</legend>
				<Scrollbar color='dark' className='fill'>
					<div className='list reverse withDropButtons'>
						{
							heldItem.type !== 'nothing' ? (
								<div className='overlay' />
							) : null
						}
						{
							outfit.items.map((item, index) => (
								<React.Fragment key={ index }>
									<div className='overlayDropContainer'>
										{
											heldItem.type !== 'nothing' ? (
												<OutfitEditItemDropArea
													insertTemplate={ (newTemplate) => {
														insertItemTemplate(index, newTemplate);
													} }
												/>
											) : null
										}
									</div>
									<OutfitEditViewItem
										itemTemplate={ item }
										updateItemTemplate={ (newTemplate) => {
											updateItemTemplate(index, newTemplate);
										} }
										reorderItemTemplate={ (shift) => {
											reorderItemTemplate(index, shift);
										} }
									/>
								</React.Fragment>
							))
						}
						<div className='overlayDropContainer'>
							{
								heldItem.type !== 'nothing' ? (
									<OutfitEditItemDropArea
										insertTemplate={ (newTemplate) => {
											insertItemTemplate(null, newTemplate);
										} }
									/>
								) : null
							}
						</div>
					</div>
				</Scrollbar>
			</fieldset>
		</Column>
	);
}

function OutfitEditItemDropArea({ insertTemplate }: {
	insertTemplate: (newTemplate: ItemTemplate) => void;
}): ReactElement | null {
	const { heldItem, setHeldItem, globalState } = useWardrobeContext();

	const action = useMemo((): (() => void) | null => {
		if (heldItem.type === 'nothing')
			return null;

		if (heldItem.type === 'item') {
			return () => {
				const rootItems = globalState.getItems(heldItem.target);
				const item = EvalItemPath(rootItems ?? EMPTY_ARRAY, heldItem.path);
				if (!item) {
					toast(`Held item not found`, TOAST_OPTIONS_ERROR);
					return;
				}

				insertTemplate(item.exportToTemplate());
				setHeldItem({ type: 'nothing' });
			};
		}

		if (heldItem.type === 'template') {
			return () => {
				insertTemplate(CloneDeepMutable(heldItem.template));
				setHeldItem({ type: 'nothing' });
			};
		}

		AssertNever(heldItem);
	}, [heldItem, globalState, insertTemplate, setHeldItem]);

	const text = useMemo<string | null>(() => {
		if (heldItem.type === 'nothing')
			return null;

		if (heldItem.type === 'item') {
			return 'Create template from item';
		}

		if (heldItem.type === 'template') {
			return 'Copy template here';
		}

		AssertNever(heldItem);
	}, [heldItem]);

	if (action == null || text == null) {
		return null;
	}

	return (
		<div
			tabIndex={ 0 }
			className='wardrobeActionButton allowed slim overlayDrop'
			onClick={ action }
		>
			{ text }
		</div>
	);
}

function OutfitEditViewItem({ itemTemplate, updateItemTemplate, reorderItemTemplate }: {
	itemTemplate: ItemTemplate;
	updateItemTemplate: (newTemplate: ItemTemplate | null) => void;
	reorderItemTemplate: (shift: number) => void;
}): ReactElement {
	const confirm = useConfirmDialog();
	const assetManager = useAssetManager();
	const { setHeldItem } = useWardrobeContext();

	const asset = assetManager.getAssetById(itemTemplate.asset);

	if (asset == null) {
		return (
			<div
				className='inventoryViewItem listMode blocked'
			>
				<span className='itemName'>[ ERROR: Unknown asset { itemTemplate.asset } ]</span>
				<div className='quickActions'>
					<button
						className='wardrobeActionButton allowed'
						onClick={ () => {
							updateItemTemplate(null);
						} }
					>
						➖
					</button>
				</div>
			</div>
		);
	}

	const ribbonColor = (asset.isType('personal') || asset.isType('roomDevice')) ? (
		itemTemplate.color?.[
			asset.definition.colorRibbonGroup ??
			first(Object.keys(asset.definition.colorization ?? {})) ??
			''
		]
	) : undefined;

	const visibleName = asset.definition.name;

	return (
		<div
			tabIndex={ 0 }
			className='inventoryViewItem listMode allowed'
			onClick={ () => {
				setHeldItem({
					type: 'template',
					template: CloneDeepMutable(itemTemplate),
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
			<span className='itemName'>{ visibleName }</span>
			<div className='quickActions'>
				<button
					className='wardrobeActionButton allowed'
					onClick={ (ev) => {
						ev.stopPropagation();
						reorderItemTemplate(1);
					} }
				>
					▲
				</button>
				<button
					className='wardrobeActionButton allowed'
					onClick={ (ev) => {
						ev.stopPropagation();
						reorderItemTemplate(-1);
					} }
				>
					▼
				</button>
				<button
					className='wardrobeActionButton allowed'
					onClick={ (ev) => {
						ev.stopPropagation();
						confirm(`Are you sure you want to delete item "${visibleName}" from the outfit?`)
							.then((result) => {
								if (!result)
									return;

								updateItemTemplate(null);
							})
							.catch(noop);
					} }
				>
					➖
				</button>
			</div>
		</div>
	);
}
