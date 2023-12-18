import React from 'react';
import { AssetAttributeDefinition, EMPTY_ARRAY } from 'pandora-common';
import { InventoryAssetView } from './views/wardrobeAssetView';
import { useAssetManager } from '../../assets/assetManager';

export function WardrobePreferencesGui() {
	const assetManager = useAssetManager();
	const assetFilterCharacterAttributes = React.useMemo<string[]>(() => ([...assetManager.attributes.entries()]
		.filter((a) => AttributeFilter(a[1]))
		.map((a) => a[0])
	), [assetManager]);

	const assets = React.useMemo(() => (assetManager.assetList
		.filter((a) => a.isType('personal') || a.isType('lock'))
	), [assetManager]);

	return (
		<div className='wardrobe-ui'>
			<InventoryAssetView
				title='Assets'
				assets={ assets }
				attributesFilterOptions={ assetFilterCharacterAttributes }
				container={ EMPTY_ARRAY }
				spawnStyle='preference' />
		</div>
	);
}

function AttributeFilter(a: AssetAttributeDefinition) {
	switch (a.useAsWardrobeFilter?.tab) {
		case 'item':
		case 'body':
			return true;
		case 'room':
		case undefined:
			return false;
	}
}
