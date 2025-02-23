import classNames from 'classnames';
import _, { clamp, first, noop } from 'lodash';
import { nanoid } from 'nanoid';
import {
	AppearanceBundle,
	AssetFrameworkCharacterState,
	AssetFrameworkGlobalState,
	AssetFrameworkOutfit,
	AssetFrameworkOutfitSchema,
	AssetFrameworkOutfitWithId,
	AssetFrameworkRoomState,
	CloneDeepMutable,
	CreateItemBundleFromTemplate,
	GetLogger,
	ITEM_LIMIT_ACCOUNT_OUTFIT_STORAGE,
	ItemContainerPath,
	ItemTemplate,
	LIMIT_OUTFIT_NAME_LENGTH,
	OutfitMeasureCost,
} from 'pandora-common';
import { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { useAssetManager } from '../../../assets/assetManager';
import crossIcon from '../../../assets/icons/cross.svg';
import deleteIcon from '../../../assets/icons/delete.svg';
import diskIcon from '../../../assets/icons/disk.svg';
import editIcon from '../../../assets/icons/edit.svg';
import { useBrowserSessionStorage } from '../../../browserStorage';
import { CHARACTER_PIVOT_POSITION, GraphicsCharacter } from '../../../graphics/graphicsCharacter';
import { GraphicsSceneBackgroundRenderer } from '../../../graphics/graphicsSceneRenderer';
import { useRoomCharacterOffsets } from '../../../graphics/room/roomCharacter';
import { usePlayerVisionFilters } from '../../../graphics/room/roomScene';
import { TOAST_OPTIONS_ERROR } from '../../../persistentToast';
import { useAccountSettings } from '../../../services/accountLogic/accountManagerHooks';
import { serviceManagerContext } from '../../../services/serviceProvider';
import { Button, IconButton } from '../../common/button/button';
import { Column, DivContainer, Row } from '../../common/container/container';
import { useConfirmDialog } from '../../dialog/dialog';
import { ImportDialog } from '../../exportImport/importDialog';
import { useDirectoryChangeListener, useDirectoryConnector } from '../../gameContext/directoryConnectorContextProvider';
import { THEME_NORMAL_BACKGROUND } from '../../gameContext/interfaceSettingsProvider';
import { usePlayerState } from '../../gameContext/playerContextProvider';
import { ResolveItemDisplayNameType } from '../itemDetail/wardrobeItemName';
import { useWardrobeActionContext } from '../wardrobeActionContext';
import { InventoryAssetPreview, StorageUsageMeter, WardrobeActionButton, WardrobeColorRibbon } from '../wardrobeComponents';
import { useWardrobeContext } from '../wardrobeContext';
import { OutfitEditView } from './wardrobeOutfitEditView';

export function InventoryOutfitView({ targetContainer }: {
	targetContainer: ItemContainerPath;
}): ReactElement | null {
	const storedOutfits = useStoredOutfits();
	const saveOutfits = useSaveStoredOutfits();

	const [isImporting, setIsImporting] = useState(false);
	const [editedOutfitId, setEditedOutfitId] = useState<string | null>(null);
	const [temporaryOutfit, setTemporaryOutfit] = useBrowserSessionStorage<AssetFrameworkOutfit | null>(
		'wardrobe.temporary_outfit',
		null,
		AssetFrameworkOutfitSchema.nullable(),
	);

	const updateOutfit = useCallback((id: string, newData: AssetFrameworkOutfit | null) => {
		if (storedOutfits == null)
			return;

		const index = storedOutfits.findIndex((outfit) => outfit.id === id);
		if (index < 0) {
			toast(`Failed to save collection changes: \nCollection not found`, TOAST_OPTIONS_ERROR);
			return;
		}

		const newStorage = [...storedOutfits];
		if (newData != null) {
			newStorage[index] = {
				...newData,
				id,
			};
		} else {
			newStorage.splice(index, 1);
			if (editedOutfitId === id) {
				setEditedOutfitId(null);
			}
		}

		saveOutfits(newStorage);
	}, [storedOutfits, saveOutfits, editedOutfitId]);

	const reorderOutfit = useCallback((id: string, shift: number) => {
		if (storedOutfits == null)
			return;

		const index = storedOutfits.findIndex((outfit) => outfit.id === id);
		if (index < 0) {
			toast(`Failed to move collection: \nCollection not found`, TOAST_OPTIONS_ERROR);
			return;
		}

		const newStorage = [...storedOutfits];

		const movedOutfit = newStorage.splice(index, 1)[0];
		const newIndex = clamp(index + shift, 0, storedOutfits.length);
		newStorage.splice(newIndex, 0, movedOutfit);

		saveOutfits(newStorage);
	}, [storedOutfits, saveOutfits]);

	if (storedOutfits == null) {
		return (
			<div className='inventoryView'>
				<div className='toolbar'>
					<StorageUsageMeter title='Storage used' used={ null } limit={ ITEM_LIMIT_ACCOUNT_OUTFIT_STORAGE } />
					<div className='flex-1' />
					<Button
						onClick={ () => {
							setIsImporting(true);
						} }
					>
						Import collection
					</Button>
				</div>
				<DivContainer className='flex-1' align='center' justify='center'>
					Loading...
				</DivContainer>
			</div>
		);
	}

	const storageUsed = storedOutfits.reduce((p, outfit) => p + OutfitMeasureCost(outfit), 0);
	const storageAvailableTotal = ITEM_LIMIT_ACCOUNT_OUTFIT_STORAGE;

	if (temporaryOutfit != null) {
		const saveTemporaryOutfit = () => {
			const newOutfit: AssetFrameworkOutfitWithId = {
				...(CloneDeepMutable(temporaryOutfit)),
				id: nanoid(),
			};

			saveOutfits([
				...storedOutfits,
				newOutfit,
			], () => {
				setTemporaryOutfit(null);
			});
		};

		if (editedOutfitId === 'temporaryOutfit') {
			return (
				<div className='inventoryView'>
					<div className='toolbar'>
						<span>Editing:&nbsp;<strong>Temporary collection</strong></span>
					</div>
					<OutfitEditView
						outfit={ temporaryOutfit }
						updateOutfit={ (newOutfit) => {
							setTemporaryOutfit(newOutfit);
							if (newOutfit == null) {
								setEditedOutfitId(null);
							}
						} }
						isTemporary
						extraActions={ (
							<>
								<button
									className='wardrobeActionButton allowed'
									onClick={ () => {
										saveTemporaryOutfit();
										setEditedOutfitId(null);
									} }
								>
									<img src={ diskIcon } alt='Save collection' />&nbsp;Save collection
								</button>
								<div className='flex-1' />
								<button
									className='wardrobeActionButton allowed'
									onClick={ () => {
										setEditedOutfitId(null);
									} }
								>
									◄ Back
								</button>
							</>
						) }
					/>
				</div>
			);
		}
		return (
			<div className='inventoryView'>
				<div className='toolbar'>
					<span className='center-flex'><strong>Temporary collection</strong></span>
				</div>
				<div className='Scrollbar'>
					<Column className='flex-1' padding='small'>
						<Row alignX='center' padding='medium'>
							<strong>This collection is temporary and will be lost when the game is closed</strong>
						</Row>
						<TemporaryOutfitEntry
							outfit={ temporaryOutfit }
							saveOutfit={ saveTemporaryOutfit }
							updateOutfit={ (newData) => setTemporaryOutfit(newData) }
							beginEditOutfit={ () => setEditedOutfitId('temporaryOutfit') }
							targetContainer={ targetContainer }
						/>
					</Column>
				</div>
			</div>
		);
	}

	if (editedOutfitId != null) {
		const editedOutfit = storedOutfits.find((outfit) => outfit.id === editedOutfitId);

		return (
			<div className='inventoryView'>
				<div className='toolbar'>
					<span>Editing collection: { editedOutfit?.name ?? editedOutfitId }</span>
					<StorageUsageMeter title='Storage used' used={ storageUsed } limit={ storageAvailableTotal } />
					<IconButton
						onClick={ () => setEditedOutfitId(null) }
						theme='default'
						src={ crossIcon }
						alt='Stop editing'
					/>
				</div>
				{
					editedOutfit != null ? (
						<OutfitEditView
							key={ editedOutfitId }
							outfit={ editedOutfit }
							updateOutfit={ (newData) => updateOutfit(editedOutfitId, newData) }
							extraActions={ (
								<button
									className='wardrobeActionButton allowed'
									onClick={ () => {
										const suffix = ' Copy';
										setTemporaryOutfit({
											...(CloneDeepMutable(editedOutfit)),
											name: editedOutfit.name.substring(0, LIMIT_OUTFIT_NAME_LENGTH - suffix.length) + suffix,
										});
										setEditedOutfitId('temporaryOutfit');
									} }
								>
									<img src={ editIcon } alt='Duplicate action' />&nbsp;Duplicate
								</button>
							) }
						/>
					) : (
						<DivContainer align='center' justify='center' className='flex-1'>
							[ ERROR: COLLECTION NOT FOUND ]
						</DivContainer>
					)
				}
			</div>
		);
	}

	return (
		<div className='inventoryView'>
			{
				isImporting ? (
					<ImportDialog
						expectedType='ItemCollection'
						expectedVersion={ 1 }
						dataSchema={ AssetFrameworkOutfitSchema }
						closeDialog={ () => {
							setIsImporting(false);
						} }
						onImport={ (data) => {
							setTemporaryOutfit(data);
							setIsImporting(false);
						} }
					/>
				) : null
			}
			<div className='toolbar'>
				<StorageUsageMeter title='Storage used' used={ storageUsed } limit={ storageAvailableTotal } />
				<div className='flex-1' />
				<Button
					onClick={ () => {
						setIsImporting(true);
					} }
				>
					Import
				</Button>
			</div>
			<div className='listContainer outfitList'>
				<div className='Scrollbar'>
					<Column overflowY='hidden' padding='small'>
						{
							storedOutfits.map((outfit) => (
								<OutfitEntry
									key={ outfit.id }
									outfit={ outfit }
									updateOutfit={ (newData) => updateOutfit(outfit.id, newData) }
									reorderOutfit={ (shift) => reorderOutfit(outfit.id, shift) }
									beginEditOutfit={ () => setEditedOutfitId(outfit.id) }
									targetContainer={ targetContainer }
								/>
							))
						}
						<OutfitEntryCreate
							onClick={ () => {
								setTemporaryOutfit({
									name: `Outfit #${storedOutfits.length + 1}`,
									items: [],
								});
								setEditedOutfitId('temporaryOutfit');
							} }
						/>
					</Column>
				</div>
			</div>
		</div>
	);
}

function OutfitPreview({ outfit }: {
	outfit: AssetFrameworkOutfit;
}): ReactElement {
	const assetManager = useAssetManager();
	const { globalState } = useWardrobeActionContext();
	const { target, showHoverPreview, actionPreviewState } = useWardrobeContext();
	const { player, playerState } = usePlayerState();

	const [isHovering, setIsHovering] = useState(false);

	const baseCharacterState = (target.type === 'character' ? globalState.getCharacterState(target.id) : null) ?? playerState;

	const characterState = useMemo((): AssetFrameworkCharacterState => {
		// As a base use the current character, but only body - not any items
		const templateBundle = baseCharacterState.items
			.filter((item) => item.isType('bodypart'))
			.map((item) => item.exportToBundle({}));

		const overwrittenBodyparts = new Set<string>();

		for (const itemTemplate of outfit.items) {
			const itemBundle = CreateItemBundleFromTemplate(itemTemplate, {
				assetManager,
				creator: player.gameLogicCharacter,
				createItemBundleFromTemplate: CreateItemBundleFromTemplate,
			});
			if (itemBundle != null) {
				const asset = assetManager.getAssetById(itemBundle.asset);
				// We need to overwrite bodyparts of type we are adding for the preview to make sense
				if (asset?.isType('bodypart') && !overwrittenBodyparts.has(asset.definition.bodypart)) {
					const bodypart = asset.definition.bodypart;
					// But we don't want to drop bodyparts that are in the outfit multiple times (e.g. hairs)
					overwrittenBodyparts.add(bodypart);
					_.remove(templateBundle, (oldItem) => {
						const oldAsset = assetManager.getAssetById(oldItem.asset);
						return oldAsset?.isType('bodypart') && oldAsset.definition.bodypart === bodypart;
					});
				}

				templateBundle.push(itemBundle);
			}
		}

		const characterBundle: AppearanceBundle = {
			items: templateBundle,
			requestedPose: CloneDeepMutable(baseCharacterState.requestedPose),
		};
		return AssetFrameworkCharacterState.loadFromBundle(assetManager, baseCharacterState.id, characterBundle, null, undefined);
	}, [assetManager, baseCharacterState, outfit, player]);

	useEffect(() => {
		if (!isHovering || !showHoverPreview)
			return;

		let previewState = AssetFrameworkGlobalState.createDefault(assetManager, AssetFrameworkRoomState.createDefault(assetManager));
		previewState = previewState.withCharacter(characterState.id, characterState);

		actionPreviewState.value = previewState;

		return () => {
			if (actionPreviewState.value === previewState) {
				actionPreviewState.value = null;
			}
		};
	}, [isHovering, showHoverPreview, actionPreviewState, assetManager, characterState]);

	const { pivot } = useRoomCharacterOffsets(characterState);
	const filters = usePlayerVisionFilters(true);

	return (
		<div
			className='fill'
			onMouseEnter={ () => {
				setIsHovering(true);
			} }
			onMouseLeave={ () => {
				setIsHovering(false);
			} }
		>
			<GraphicsSceneBackgroundRenderer
				renderArea={ { x: 97, y: 145, width: 806, height: 1210 } }
				resolution={ 1 }
				backgroundColor={ Number.parseInt(THEME_NORMAL_BACKGROUND.substring(1, 7), 16) }
				forwardContexts={ [serviceManagerContext] }
			>
				<GraphicsCharacter
					position={ { x: CHARACTER_PIVOT_POSITION.x, y: CHARACTER_PIVOT_POSITION.y } }
					pivot={ pivot }
					characterState={ characterState }
					filters={ filters }
				/>
			</GraphicsSceneBackgroundRenderer>
		</div>
	);
}

function TemporaryOutfitEntry({ outfit, saveOutfit, updateOutfit, beginEditOutfit, targetContainer }: {
	outfit: AssetFrameworkOutfit;
	saveOutfit: () => void;
	updateOutfit: (newData: AssetFrameworkOutfit | null) => void;
	beginEditOutfit: () => void;
	targetContainer: ItemContainerPath;
}): ReactElement {
	const { wardrobeOutfitsPreview } = useAccountSettings();

	return (
		<div className='outfit'>
			<button className='outfitMainButton'>
				<div className={ classNames('outfitPreview', wardrobeOutfitsPreview === 'big' ? 'big' : null) }>
					{
						wardrobeOutfitsPreview !== 'disabled' ? (
							<OutfitPreview outfit={ outfit } />
						) : (
							null
						)
					}
				</div>
				<Column padding='medium' alignX='start' alignY='space-evenly'>
					<span>{ outfit.name }</span>
					<span>Storage usage: { OutfitMeasureCost(outfit) }</span>
				</Column>
			</button>
			<Row className='toolbar'>
				<button
					className='wardrobeActionButton allowed flex-1'
					onClick={ saveOutfit }
				>
					<img src={ diskIcon } alt='Save outfit' />&nbsp;Save collection
				</button>
				<button
					className='wardrobeActionButton allowed flex-1'
					onClick={ beginEditOutfit }
				>
					<img src={ editIcon } alt='Edit action' />&nbsp;Edit
				</button>
				<button
					className='wardrobeActionButton allowed flex-1'
					onClick={ () => {
						updateOutfit(null);
					} }
				>
					<img src={ deleteIcon } alt='Discard action' /> Discard collection
				</button>
			</Row>
			<div className='list reverse'>
				{
					outfit.items.map((item, index) => (
						<OutfitEntryItem
							key={ index }
							itemTemplate={ item }
							targetContainer={ targetContainer }
						/>
					))
				}
			</div>
		</div>
	);
}

function OutfitEntry({ outfit, updateOutfit, reorderOutfit, beginEditOutfit, targetContainer }: {
	outfit: AssetFrameworkOutfit;
	updateOutfit: (newData: AssetFrameworkOutfit | null) => void;
	reorderOutfit: (shift: number) => void;
	beginEditOutfit: () => void;
	targetContainer: ItemContainerPath;
}): ReactElement {
	const { wardrobeOutfitsPreview } = useAccountSettings();
	const [expanded, setExpanded] = useState(false);
	const confirm = useConfirmDialog();

	return (
		<div className='outfit'>
			<button className='outfitMainButton' onClick={ () => setExpanded(!expanded) }>
				<div className={ classNames('outfitPreview', wardrobeOutfitsPreview === 'big' ? 'big' : null) }>
					{
						wardrobeOutfitsPreview !== 'disabled' ? (
							<OutfitPreview outfit={ outfit } />
						) : (
							null
						)
					}
				</div>
				<Column padding='medium' alignX='start' alignY='space-evenly'>
					<span>{ outfit.name }</span>
					<span>Storage usage: { OutfitMeasureCost(outfit) }</span>
				</Column>
			</button>
			{
				!expanded ? null : (
					<Row className='toolbar'>
						<button
							className='wardrobeActionButton allowed flex-1'
							onClick={ () => {
								reorderOutfit(-1);
							} }
						>
							▲ Move up
						</button>
						<button
							className='wardrobeActionButton allowed flex-1'
							onClick={ () => {
								reorderOutfit(1);
							} }
						>
							▼ Move down
						</button>
						<button
							className='wardrobeActionButton allowed flex-1'
							onClick={ () => {
								beginEditOutfit();
							} }
						>
							<img src={ editIcon } alt='Edit action' />&nbsp;Edit
						</button>
						<button
							className='wardrobeActionButton allowed flex-1'
							onClick={ () => {
								confirm('Confirm Deletion', `Are you sure you want to delete the outfit "${outfit.name}"?`)
									.then((result) => {
										if (!result)
											return;

										updateOutfit(null);
									})
									.catch(noop);
							} }
						>
							<img src={ deleteIcon } alt='Delete action' /> Delete
						</button>
					</Row>
				)
			}
			{
				!expanded ? null : (
					<div className='list reverse'>
						{
							outfit.items.map((item, index) => (
								<OutfitEntryItem
									key={ index }
									itemTemplate={ item }
									targetContainer={ targetContainer }
								/>
							))
						}
					</div>
				)
			}
		</div>
	);
}

function OutfitEntryItem({ itemTemplate, targetContainer }: {
	itemTemplate: ItemTemplate;
	targetContainer: ItemContainerPath;
}): ReactElement {
	const assetManager = useAssetManager();
	const { setHeldItem, targetSelector, itemDisplayNameType } = useWardrobeContext();

	const asset = assetManager.getAssetById(itemTemplate.asset);

	if (asset == null) {
		return (
			<div
				className='inventoryViewItem listMode blocked'
			>
				<span className='itemName'>[ ERROR: Unknown asset { itemTemplate.asset } ]</span>
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

	const visibleName = ResolveItemDisplayNameType(asset.definition.name, itemTemplate.name, itemDisplayNameType);

	if (!asset.canBeSpawned()) {
		return (
			<div
				className='inventoryViewItem listMode blocked'
			>
				<span className='itemName'>[ ERROR: Asset { itemTemplate.asset } cannot be spawned manually ]</span>
			</div>
		);
	}

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
				ribbonColor ? <WardrobeColorRibbon ribbonColor={ ribbonColor } /> : null
			}
			<InventoryAssetPreview asset={ asset } small={ true } />
			<span className='itemName'>
				{
					itemTemplate.name && itemTemplate.name !== asset.definition.name && itemDisplayNameType === 'custom' ? <i>{ visibleName }</i> : visibleName
				}
			</span>
			<div className='quickActions'>
				<WardrobeActionButton
					Element='div'
					action={ {
						type: 'create',
						target: targetSelector,
						itemTemplate: CloneDeepMutable(itemTemplate),
						container: targetContainer,
					} }
				>
					➕
				</WardrobeActionButton>
			</div>
		</div>
	);
}

function OutfitEntryCreate({ onClick }: {
	onClick: () => void;
}): ReactElement {

	return (
		<div className='outfit'>
			<button className='outfitMainButton' onClick={ onClick }>
				<div className='outfitPreview'>
					<div className='img'>
						➕
					</div>
				</div>
				<Column padding='medium' alignX='start' alignY='space-evenly'>
					<span>Create a new collection</span>
				</Column>
			</button>
		</div>
	);
}

/**
 * Provides a way to update outfit storage
 * @returns A callback usable to overwrite outfit storage, saving data to the server
 */
function useSaveStoredOutfits(): (newStorage: AssetFrameworkOutfitWithId[], onSuccess?: () => void) => void {
	const directoryConnector = useDirectoryConnector();

	return useCallback((newStorage: AssetFrameworkOutfitWithId[], onSuccess?: () => void) => {
		directoryConnector.awaitResponse('storedOutfitsSave', {
			storedOutfits: newStorage,
		})
			.then((result) => {
				if (result.result === 'ok') {
					onSuccess?.();
				} else {
					toast(`Failed to save outfit changes: \n${result.reason}`, TOAST_OPTIONS_ERROR);
				}
			})
			.catch((err) => {
				GetLogger('useSaveStoredOutfits').error('Error saving saved items:', err);
				toast(`Failed to save changes: \n${String(err)}`, TOAST_OPTIONS_ERROR);
			});
	}, [directoryConnector]);
}

/**
 * Loads the saved outfits from server
 * @returns The saved outfits or `undefined` if data is not yet ready
 */
function useStoredOutfits(): AssetFrameworkOutfitWithId[] | undefined {
	const [storedOutfits, setStoredOutfits] = useState<AssetFrameworkOutfitWithId[] | undefined>();
	const directoryConnector = useDirectoryConnector();

	const fetchStoredOutfits = useCallback(async () => {
		const result = await directoryConnector.awaitResponse('storedOutfitsGetAll', {});
		setStoredOutfits(result.storedOutfits);
	}, [directoryConnector]);

	useDirectoryChangeListener('storedOutfits', () => {
		fetchStoredOutfits().catch(noop);
	}, true);

	return storedOutfits;
}
