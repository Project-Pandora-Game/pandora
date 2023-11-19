import React, { ReactElement, useCallback, useState } from 'react';
import { Button } from '../../common/button/button';
import { Scrollbar } from '../../common/scrollbar/scrollbar';
import { AssetFrameworkOutfit, GetLogger, LIMIT_ACCOUNT_OUTFIT_STORAGE_ITEMS, OutfitMeasureCost } from 'pandora-common';
import { useDirectoryChangeListener, useDirectoryConnector } from '../../gameContext/directoryConnectorContextProvider';
import { noop } from 'lodash';
import { Column, DivContainer } from '../../common/container/container';
import { toast } from 'react-toastify';
import { TOAST_OPTIONS_ERROR } from '../../../persistentToast';

export function InventoryOutfitView(): ReactElement | null {
	const storedOutfits = useStoredOutfits();
	const saveOutfits = useSaveStoredOutfits();

	const createNewOutfit = useCallback(() => {
		if (storedOutfits == null)
			return;

		const newOutfit: AssetFrameworkOutfit = {
			name: `Outfit #${storedOutfits.length + 1}`,
			items: [],
		};

		saveOutfits([
			...storedOutfits,
			newOutfit,
		]);
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
							storedOutfits.map((outfit, i) => (
								<OutfitEntry
									key={ i }
									outfit={ outfit }
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

function OutfitEntry({ outfit }: {
	outfit: AssetFrameworkOutfit;
}): ReactElement {

	return (
		<div className='outfit'>
			<button className='outfitMainButton'>
				<div className='outfitPreview'>
					<div className='img' />
				</div>
				<Column padding='medium' alignX='start' alignY='space-evenly'>
					<span>{ outfit.name }</span>
					<span>Storage usage: { OutfitMeasureCost(outfit) }</span>
				</Column>
			</button>
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

function useSaveStoredOutfits(): (newStorage: AssetFrameworkOutfit[]) => void {
	const directoryConnector = useDirectoryConnector();

	return useCallback((newStorage: AssetFrameworkOutfit[]) => {
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

function useStoredOutfits(): AssetFrameworkOutfit[] | undefined {
	const [storedOutfits, setStoredOutfits] = useState<AssetFrameworkOutfit[] | undefined>();
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
