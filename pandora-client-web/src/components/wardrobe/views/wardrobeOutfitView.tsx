import React, { ReactElement, useCallback, useState } from 'react';
import { Button } from '../../common/button/button';
import { Scrollbar } from '../../common/scrollbar/scrollbar';
import { AssetFrameworkOutfit, AssetFrameworkOutfitWithId, GetLogger, LIMIT_ACCOUNT_OUTFIT_STORAGE_ITEMS, OutfitMeasureCost } from 'pandora-common';
import { useDirectoryChangeListener, useDirectoryConnector } from '../../gameContext/directoryConnectorContextProvider';
import { clamp, noop } from 'lodash';
import { Column, DivContainer, Row } from '../../common/container/container';
import { toast } from 'react-toastify';
import { TOAST_OPTIONS_ERROR, TOAST_OPTIONS_WARNING } from '../../../persistentToast';
import { useConfirmDialog } from '../../dialog/dialog';
import { nanoid } from 'nanoid';

export function InventoryOutfitView(): ReactElement | null {
	const storedOutfits = useStoredOutfits();
	const saveOutfits = useSaveStoredOutfits();

	const createNewOutfit = useCallback(() => {
		if (storedOutfits == null)
			return;

		const newOutfit: AssetFrameworkOutfitWithId = {
			id: nanoid(),
			name: `Outfit #${storedOutfits.length + 1}`,
			items: [],
		};

		saveOutfits([
			...storedOutfits,
			newOutfit,
		]);
	}, [storedOutfits, saveOutfits]);

	const updateOutfit = useCallback((id: string, newData: AssetFrameworkOutfit | null) => {
		if (storedOutfits == null)
			return;

		const index = storedOutfits.findIndex((outfit) => outfit.id === id);
		if (index < 0) {
			toast(`Failed to save outfit changes: \nOutfit not found`, TOAST_OPTIONS_ERROR);
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
		}

		saveOutfits(newStorage);
	}, [storedOutfits, saveOutfits]);

	const reorderOutfit = useCallback((id: string, shift: number) => {
		if (storedOutfits == null)
			return;

		const index = storedOutfits.findIndex((outfit) => outfit.id === id);
		if (index < 0) {
			toast(`Failed to move outfit: \nOutfit not found`, TOAST_OPTIONS_ERROR);
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
					<span>Storage used: Loading...</span>
					<Button>Import outfit</Button>
				</div>
				<DivContainer className='flex-1' align='center' justify='center'>
					Loading...
				</DivContainer>
			</div>
		);
	}

	const storageUsed = storedOutfits.reduce((p, outfit) => p + OutfitMeasureCost(outfit), 0);
	const storageAvailableTotal = LIMIT_ACCOUNT_OUTFIT_STORAGE_ITEMS;

	return (
		<div className='inventoryView'>
			<div className='toolbar'>
				<span>Storage used: { storageUsed } / { storageAvailableTotal } ({ Math.ceil(100 * storageUsed / storageAvailableTotal) }%)</span>
				<Button>Import outfit</Button>
			</div>
			<div className='listContainer outfitList'>
				<Scrollbar color='dark'>
					<Column overflowY='hidden' padding='small'>
						{
							storedOutfits.map((outfit) => (
								<OutfitEntry
									key={ outfit.id }
									outfit={ outfit }
									updateOutfit={ (newData) => updateOutfit(outfit.id, newData) }
									reorderOutfit={ (shift) => reorderOutfit(outfit.id, shift) }
								/>
							))
						}
						<OutfitEntryCreate
							onClick={ createNewOutfit }
						/>
					</Column>
				</Scrollbar>
			</div>
		</div>
	);
}

function OutfitEntry({ outfit, updateOutfit, reorderOutfit }: {
	outfit: AssetFrameworkOutfit;
	updateOutfit: (newData: AssetFrameworkOutfit | null) => void;
	reorderOutfit: (shift: number) => void;
}): ReactElement {
	const [expanded, setExpanded] = useState(false);
	const confirm = useConfirmDialog();

	return (
		<div className='outfit'>
			<button className='outfitMainButton' onClick={ () => setExpanded(!expanded) }>
				<div className='outfitPreview'>
					<div className='img' />
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
								// TODO
								toast(`Not Yet Implemented`, TOAST_OPTIONS_WARNING);
							} }
						>
							Edit
						</button>
						<button
							className='wardrobeActionButton allowed flex-1'
							onClick={ () => {
								confirm(`Are you sure you want to delete outfit "${outfit.name}"?`)
									.then((result) => {
										if (!result)
											return;

										updateOutfit(null);
									})
									.catch(noop);
							} }
						>
							➖ Delete
						</button>
					</Row>
				)
			}
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
					<span>Create a new outfit</span>
				</Column>
			</button>
		</div>
	);
}

function useSaveStoredOutfits(): (newStorage: AssetFrameworkOutfitWithId[]) => void {
	const directoryConnector = useDirectoryConnector();

	return useCallback((newStorage: AssetFrameworkOutfitWithId[]) => {
		directoryConnector.awaitResponse('storedOutfitsSave', {
			storedOutfits: newStorage,
		})
			.then((result) => {
				if (result.result !== 'ok') {
					toast(`Failed to save outfit changes: \n${result.reason}`, TOAST_OPTIONS_ERROR);
				}
			})
			.catch((err) => {
				GetLogger('useSaveStoredOutfits').error('Error saving outfits:', err);
				toast(`Failed to save outfit changes: \n${String(err)}`, TOAST_OPTIONS_ERROR);
			});
	}, [directoryConnector]);
}

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
