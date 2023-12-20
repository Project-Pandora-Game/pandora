import React from 'react';
import { AssetAttributeDefinition, AttributePreferenceType, EMPTY_ARRAY, Obj } from 'pandora-common';
import { InventoryAssetView, useAssetPreferences } from './views/wardrobeAssetView';
import { useAssetManager } from '../../assets/assetManager';
import { Scrollbar } from '../common/scrollbar/scrollbar';
import { toast } from 'react-toastify';
import { useGraphicsUrl } from '../../assets/graphicsManager';
import { TOAST_OPTIONS_ERROR } from '../../persistentToast';
import { useShardConnector } from '../gameContext/shardConnectorContextProvider';

export function WardrobePreferencesGui() {
	const assetManager = useAssetManager();
	const assetFilterCharacterAttributes = React.useMemo<string[]>(() => ([...assetManager.attributes.entries()]
		.filter((a) => ItemAttributeFilter(a[1]))
		.map((a) => a[0])
	), [assetManager]);

	const assets = React.useMemo(() => (assetManager.assetList
		.filter((a) => a.isType('personal') || a.isType('lock'))
	), [assetManager]);

	return (
		<div className='wardrobe-ui'>
			<InventoryAttributePreferenceView />
			<InventoryAssetView
				title='Assets'
				assets={ assets }
				attributesFilterOptions={ assetFilterCharacterAttributes }
				container={ EMPTY_ARRAY }
				spawnStyle='preference' />
		</div>
	);
}

function ItemAttributeFilter(a: AssetAttributeDefinition) {
	switch (a.useAsWardrobeFilter?.tab) {
		case 'item':
		case 'body':
			return true;
		case 'room':
		case undefined:
			return false;
	}
}

function RawAttributeFilter(a: AssetAttributeDefinition) {
	switch (a.useAsWardrobeFilter?.tab) {
		case 'room':
			return false;
		case 'item':
		case 'body':
		case undefined:
			return true;
			return false;
	}
}

function InventoryAttributePreferenceView() {
	const assetManager = useAssetManager();

	const attributes = React.useMemo(() => ([...assetManager.attributes.entries()]
		.filter((a) => RawAttributeFilter(a[1]))
		.map((a) => ({ id: a[0], ...a[1] }))
	), [assetManager]);

	return (
		<div className='inventoryView'>
			<div className='listContainer'>
				<Scrollbar color='dark'>
					{
						attributes.map((a) => <AttributePreference key={ a.id } { ...a } />)
					}
				</Scrollbar>
			</div>
		</div>
	);
}

const ATTRIBUTE_PREFERENCE_DESCRIPTIONS = {
	normal: {
		name: 'Normal',
		description: 'Normal priority.',
	},
	prevent: {
		name: 'Prevent',
		description: 'Prevent items with this attribute from being used.',
	},
	doNotRender: {
		name: 'Do not render',
		description: 'Do not render this items with this attribute.',
	},
} as const satisfies Readonly<Record<AttributePreferenceType, Readonly<{ name: string; description: string; }>>>;

function AttributePreference({ id, icon, description }: AssetAttributeDefinition & { id: string; }) {
	const shardConnector = useShardConnector();
	const current = useAssetPreferences().attributes[id]?.base ?? 'normal';

	const onChange = React.useCallback((ev: React.ChangeEvent<HTMLSelectElement>) => {
		const value = ev.target.value as AttributePreferenceType;
		if (value === current)
			return;

		shardConnector?.awaitResponse('updateAssetPreferences', {
			attributes: {
				[id]: { base: value },
			},
		}).then(({ result }) => {
			if (result !== 'ok')
				toast('Asset not be worn before setting "do not render"', TOAST_OPTIONS_ERROR);
		}).catch((err) => {
			if (err instanceof Error)
				toast(`Failed to update asset preference: ${err.message}`, TOAST_OPTIONS_ERROR);
		});
	}, [id, current, shardConnector]);

	const iconSrc = useGraphicsUrl(icon);

	return (
		<div className='inventoryViewItem listMode small allowed' tabIndex={ 0 }>
			<div className={ 'itemPreview' + (iconSrc ? '' : ' missing') }>
				{
					iconSrc ? (
						<img className='black' src={ iconSrc } alt='Item preview' />
					) : (
						'?'
					)
				}
			</div>
			<span className='itemName'>{ description }</span>
			<select onChange={ onChange } value={ current }>
				{
					Obj.entries(ATTRIBUTE_PREFERENCE_DESCRIPTIONS).map(([key, { name, description: desc }]) => (
						<option key={ key } value={ key } title={ desc }>
							{ name }
						</option>
					))
				}
			</select>
		</div>
	);
}
