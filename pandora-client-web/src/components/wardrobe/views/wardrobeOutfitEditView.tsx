import classNames from 'classnames';
import { clamp, first, noop } from 'lodash-es';
import {
	AssertNever,
	AssetFrameworkOutfit,
	AssetFrameworkOutfitSchema,
	CloneDeepMutable,
	EMPTY_ARRAY,
	EvalItemPath,
	ItemTemplate,
	LIMIT_OUTFIT_NAME_LENGTH,
} from 'pandora-common';
import React, { ReactElement, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { useAssetManager } from '../../../assets/assetManager.tsx';
import deleteIcon from '../../../assets/icons/delete.svg';
import diskIcon from '../../../assets/icons/disk.svg';
import exportIcon from '../../../assets/icons/export.svg';
import { TextInput } from '../../../common/userInteraction/input/textInput.tsx';
import { TOAST_OPTIONS_ERROR } from '../../../persistentToast.ts';
import { useAccountSettings } from '../../../services/accountLogic/accountManagerHooks.ts';
import { useServiceManager } from '../../../services/serviceProvider.tsx';
import { CreateCharacterPhoto } from '../../../ui/screens/room/roomPhoto.tsx';
import { Button } from '../../common/button/button.tsx';
import { Column, Row } from '../../common/container/container.tsx';
import { useConfirmDialog } from '../../dialog/dialog.tsx';
import { ExportDialog, type ExportDialogTarget } from '../../exportImport/exportDialog.tsx';
import { usePlayerState } from '../../gameContext/playerContextProvider.tsx';
import { ResolveItemDisplayNameType } from '../itemDetail/wardrobeItemName.tsx';
import { WardrobeTemplateEditMenu } from '../templateDetail/_wardrobeTemplateDetail.tsx';
import { useWardrobeActionContext } from '../wardrobeActionContext.tsx';
import { InventoryAssetPreview, WardrobeColorRibbon } from '../wardrobeComponents.tsx';
import { useWardrobeContext } from '../wardrobeContext.tsx';
import { WardrobeContextExtraItemActionComponent } from '../wardrobeTypes.ts';
import { CreateOutfitPreviewDollState } from './wardrobeOutfitView.tsx';

export function OutfitEditView({ extraActions, outfit, updateOutfit, isTemporary = false }: {
	extraActions?: ReactNode;
	outfit: AssetFrameworkOutfit;
	updateOutfit: (newData: AssetFrameworkOutfit | null) => void;
	isTemporary?: boolean;
}): ReactElement | null {
	const confirm = useConfirmDialog();
	const { globalState } = useWardrobeActionContext();
	const { heldItem, extraItemActions, targetSelector } = useWardrobeContext();
	const [editName, setEditName] = useState(outfit.name);

	const [editedItemIndex, setEditedItemIndex] = useState<number | null>(null);
	const [showExportDialog, setShowExportDialog] = useState(false);

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
		if (editedItemIndex != null)
			return null;

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
				title='Add to collection'
			>
				<img src={ diskIcon } alt='Add to collection' />
			</button>
		);
	}, [globalState, insertItemTemplate, targetSelector, editedItemIndex]);
	useEffect(() => {
		extraItemActions.value = extraItemActions.value.concat([extraItemAction]);
		return () => {
			extraItemActions.value = extraItemActions.value.filter((a) => a !== extraItemAction);
		};
	}, [extraItemAction, extraItemActions]);

	useEffect(() => {
		if (editedItemIndex != null && outfit.items[editedItemIndex] == null) {
			setEditedItemIndex(null);
		}
	}, [editedItemIndex, outfit.items]);

	if (editedItemIndex != null) {
		const editedItem = outfit.items[editedItemIndex];

		if (editedItem == null)
			return null;

		return (
			<Column className='flex-1'>
				<WardrobeTemplateEditMenu
					title='Editing saved item'
					template={ editedItem }
					updateTemplate={ (newTemplate) => updateItemTemplate(editedItemIndex, CloneDeepMutable(newTemplate)) }
					cancelText='◄ Finish editing item'
					cancel={ () => setEditedItemIndex(null) }
				/>
			</Column>
		);
	}

	return (
		<div className='Scrollbar'>
			<Column className='flex-1' padding='small'>
				{
					showExportDialog ? (
						<OutfitExportDialog
							outfit={ outfit }
							close={ () => setShowExportDialog(false) }
						/>
					) : null
				}
				{
					isTemporary ? (
						<Row alignX='center' padding='medium'>
							<div className='warning-box'>This collection is temporary and will be lost when the game is closed</div>
						</Row>
					) : null
				}
				<Row padding='medium'>
					{
						!isTemporary ? (
							<button
								className='wardrobeActionButton allowed'
								onClick={ () => {
									confirm('Confirm deletion', `Are you sure you want to delete the collection "${outfit.name}"?`)
										.then((result) => {
											if (!result)
												return;

											updateOutfit(null);
										})
										.catch(noop);
								} }
							>
								<img src={ deleteIcon } alt='Delete action' />&nbsp;Delete collection
							</button>
						) : null
					}
					<button
						className='wardrobeActionButton allowed'
						onClick={ () => {
							setShowExportDialog(true);
						} }
					>
						<img src={ exportIcon } alt='Export action' />&nbsp;Export
					</button>
					{ extraActions }
				</Row>
				<fieldset>
					<legend>Collection name ({ editName.length }/{ LIMIT_OUTFIT_NAME_LENGTH } characters)</legend>
					<Row>
						<TextInput className='flex-1' value={ editName } maxLength={ LIMIT_OUTFIT_NAME_LENGTH } onChange={ (newName) => {
							newName = newName.substring(0, LIMIT_OUTFIT_NAME_LENGTH);
							setEditName(newName);
							if (isTemporary) {
								updateOutfit({
									...outfit,
									name: newName,
								});
							}
						} } />
						{
							isTemporary ? null : (
								<Button
									className='slim'
									onClick={ () => updateOutfit({
										...outfit,
										name: editName,
									}) }
									disabled={ outfit.name === editName }
								>
									Save
								</Button>
							)
						}
					</Row>
				</fieldset>
				<fieldset className='flex-1'>
					<legend>Items</legend>
					<div className='Scrollbar fill'>
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
											startEdit={ () => {
												setEditedItemIndex(index);
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
					</div>
				</fieldset>
			</Column>
		</div>
	);
}

function OutfitExportDialog({ outfit, close }: {
	outfit: AssetFrameworkOutfit;
	close: () => void;
}): React.ReactNode {
	const serviceManager = useServiceManager();
	const { player, playerState, globalState } = usePlayerState();

	const exportExtra = useMemo(async () => {
		const [previewCharacter] = CreateOutfitPreviewDollState(outfit, playerState, globalState, player);

		const previewCanvas = await CreateCharacterPhoto(
			previewCharacter,
			false,
			'0.5',
			serviceManager,
			[],
		);

		const previewBlob = await new Promise<Blob>((resolve, reject) => {
			previewCanvas.toBlob((blob) => {
				if (!blob) {
					reject(new Error('Canvas.toBlob failed!'));
					return;
				}

				resolve(blob);
			}, 'image/jpeg', 0.8);
		}).catch(() => new Promise<Blob>((resolve, reject) => {
			previewCanvas.toBlob((blob) => {
				if (!blob) {
					reject(new Error('Canvas.toBlob failed!'));
					return;
				}

				resolve(blob);
			}, 'image/png');
		}));

		const preview: ExportDialogTarget = {
			content: previewBlob,
			suffix: `-preview.${ previewBlob.type.split('/').at(-1) }`,
			type: previewBlob.type,
		};

		return [preview];
	}, [globalState, outfit, player, playerState, serviceManager]);

	return (
		<ExportDialog
			title={ 'item collection' + (outfit.name ? ` "${outfit.name}"` : '') }
			exportType='ItemCollection'
			exportVersion={ 1 }
			dataSchema={ AssetFrameworkOutfitSchema }
			data={ outfit }
			extraData={ exportExtra }
			closeDialog={ close }
		/>
	);
}

function OutfitEditItemDropArea({ insertTemplate }: {
	insertTemplate: (newTemplate: ItemTemplate) => void;
}): ReactElement | null {
	const { globalState } = useWardrobeActionContext();
	const { heldItem, setHeldItem } = useWardrobeContext();

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

function OutfitEditViewItem({ itemTemplate, updateItemTemplate, reorderItemTemplate, startEdit }: {
	itemTemplate: ItemTemplate;
	updateItemTemplate: (newTemplate: ItemTemplate | null) => void;
	reorderItemTemplate: (shift: number) => void;
	startEdit: () => void;
}): ReactElement {
	const confirm = useConfirmDialog();
	const assetManager = useAssetManager();
	const { wardrobeItemDisplayNameType } = useAccountSettings();

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
						<img src={ deleteIcon } alt='Delete action' />
					</button>
				</div>
			</div>
		);
	}

	const ribbonColor = (asset.isType('bodypart') || asset.isType('personal') || asset.isType('roomDevice')) ? (
		itemTemplate.color?.[
			asset.definition.colorRibbonGroup ??
			first(Object.keys(asset.definition.colorization ?? {})) ??
			''
		]
	) : undefined;

	const visibleName = ResolveItemDisplayNameType(asset.definition.name, itemTemplate.name, wardrobeItemDisplayNameType);

	if (!asset.canBeSpawned()) {
		return (
			<div
				className='inventoryViewItem listMode blocked'
			>
				<span className='itemName'>[ ERROR: Asset { itemTemplate.asset } cannot be spawned manually ]</span>
				<div className='quickActions'>
					<button
						className='wardrobeActionButton allowed'
						onClick={ () => {
							updateItemTemplate(null);
						} }
					>
						<img src={ deleteIcon } alt='Delete action' />
					</button>
				</div>
			</div>
		);
	}

	const hasCustomName = wardrobeItemDisplayNameType === 'custom' && !!itemTemplate.name && itemTemplate.name !== asset.definition.name;
	return (
		<div
			tabIndex={ 0 }
			className='inventoryViewItem listMode allowed'
			data-asset-id={ asset.id }
			onClick={ () => {
				startEdit();
			} }
		>
			{
				ribbonColor ? <WardrobeColorRibbon ribbonColor={ ribbonColor } /> : null
			}
			<InventoryAssetPreview asset={ asset } small={ true } />
			<span className={ classNames('itemName', hasCustomName ? 'custom' : null) }>
				{ visibleName }
			</span>
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
						confirm('Confirm removal', `Are you sure you want to remove the item "${visibleName}" from this collection?`)
							.then((result) => {
								if (!result)
									return;

								updateItemTemplate(null);
							})
							.catch(noop);
					} }
				>
					<img src={ deleteIcon } alt='Delete action' />
				</button>
			</div>
		</div>
	);
}
