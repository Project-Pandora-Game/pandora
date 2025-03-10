import classNames from 'classnames';
import {
	Asset,
	AssetFrameworkCharacterState,
	EMPTY_ARRAY,
	Item,
} from 'pandora-common';
import { ReactElement, useEffect, useLayoutEffect, useMemo } from 'react';
import { useAssetManager } from '../../assets/assetManager.tsx';
import { ICharacter } from '../../character/character.ts';
import { useObservable } from '../../observable.ts';
import { Tab, TabContainer } from '../common/tabs/tabs.tsx';
import { WardrobeItemConfigMenu } from './itemDetail/_wardrobeItemDetail.tsx';
import { InventoryAssetView } from './views/wardrobeAssetView.tsx';
import { WardrobeBodySizeEditor } from './views/wardrobeBodySizeView.tsx';
import { InventoryItemView } from './views/wardrobeItemView.tsx';
import { InventoryOutfitView } from './views/wardrobeOutfitView.tsx';
import { useWardrobeContext } from './wardrobeContext.tsx';
import { WardrobeFocusesItem } from './wardrobeUtils.ts';

export function WardrobeBodyManipulation({ className, character, characterState }: {
	className?: string;
	character: ICharacter;
	characterState: AssetFrameworkCharacterState;
}): ReactElement {
	const { focuser } = useWardrobeContext();
	const currentFocus = useObservable(focuser.current);
	const assetManager = useAssetManager();
	const assetList = assetManager.assetList;

	const filter = (item: Item | Asset) => {
		const asset = 'asset' in item ? item.asset : item;
		return asset.isType('bodypart');
	};

	const title = `Currently worn items`;
	// Reset selected item each time screen opens
	useLayoutEffect(() => {
		focuser.reset();
	}, [focuser]);

	useEffect(() => focuser.disableContainers('Body cannot have containers'), [focuser]);

	const bodyFilterAttributes = useMemo<string[]>(() => ([...assetManager.attributes.entries()]
		.filter((a) => a[1].useAsWardrobeFilter?.tabs.includes('body'))
		.map((a) => a[0])
	), [assetManager]);

	return (
		<div className={ classNames('wardrobe-ui', className) }>
			<InventoryItemView title={ title } filter={ filter } />
			<TabContainer className={ classNames('flex-1', WardrobeFocusesItem(currentFocus) && 'hidden') }>
				<Tab name='Change body parts'>
					<InventoryAssetView
						title='Add a new bodypart'
						assets={ assetList.filter(filter) }
						attributesFilterOptions={ bodyFilterAttributes }
						container={ EMPTY_ARRAY }
						spawnStyle='spawn'
					/>
				</Tab>
				<Tab name='Change body size'>
					<WardrobeBodySizeEditor character={ character } characterState={ characterState } />
				</Tab>
				<Tab name='Saved items'>
					<InventoryOutfitView
						targetContainer={ EMPTY_ARRAY }
					/>
				</Tab>
			</TabContainer>
			{
				WardrobeFocusesItem(currentFocus) &&
				<div className='flex-col flex-1'>
					<WardrobeItemConfigMenu key={ currentFocus.itemId } item={ currentFocus } />
				</div>
			}
		</div>
	);
}
