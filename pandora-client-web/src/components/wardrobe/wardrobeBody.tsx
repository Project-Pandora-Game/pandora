import classNames from 'classnames';
import {
	Assert,
	Asset,
	AssetFrameworkCharacterState,
	EMPTY_ARRAY,
	Item,
	ItemId,
} from 'pandora-common';
import React, { ReactElement, useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { useAssetManager } from '../../assets/assetManager';
import { ICharacter } from '../../character/character';
import { Tab, TabContainer } from '../common/tabs/tabs';
import { WardrobeFocus } from './wardrobeTypes';
import { useWardrobeContext } from './wardrobeContext';
import { InventoryItemView } from './views/wardrobeItemView';
import { InventoryAssetView } from './views/wardrobeAssetView';
import { WardrobeFocusesItem } from './wardrobeUtils';
import { WardrobeItemConfigMenu } from './itemDetail/_wardrobeItemDetail';
import { WardrobeBodySizeEditor } from './views/wardrobeBodySizeView';

export function WardrobeBodyManipulation({ className, character, characterState }: {
	className?: string;
	character: ICharacter;
	characterState: AssetFrameworkCharacterState;
}): ReactElement {
	const { assetList } = useWardrobeContext();
	const assetManager = useAssetManager();

	const filter = (item: Item | Asset) => {
		const asset = 'asset' in item ? item.asset : item;
		return asset.isType('personal') && asset.definition.bodypart !== undefined;
	};

	const [selectedItemId, setSelectedItemId] = useState<ItemId | null>(null);
	const currentFocus = useMemo<WardrobeFocus>(() => ({
		container: [],
		itemId: selectedItemId,
	}), [selectedItemId]);

	// Reset selected item each time screen opens
	useLayoutEffect(() => {
		setSelectedItemId(null);
	}, []);

	const setFocus = useCallback((newFocus: WardrobeFocus) => {
		Assert(newFocus.container.length === 0, 'Body cannot have containers');
		setSelectedItemId(newFocus.itemId);
	}, []);

	const bodyFilterAttributes = useMemo<string[]>(() => ([...assetManager.attributes.entries()]
		.filter((a) => a[1].useAsWardrobeFilter?.tab === 'body')
		.map((a) => a[0])
	), [assetManager]);

	return (
		<div className={ classNames('wardrobe-ui', className) }>
			<InventoryItemView title='Currently worn items' filter={ filter } focus={ currentFocus } setFocus={ setFocus } />
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
			</TabContainer>
			{
				WardrobeFocusesItem(currentFocus) &&
				<div className='flex-col flex-1'>
					<WardrobeItemConfigMenu key={ currentFocus.itemId } item={ currentFocus } setFocus={ setFocus } />
				</div>
			}
		</div>
	);
}
