import React from 'react';
import { Observable, useObservable } from '../../../observable';
import { AssetDefinitionEditor } from '../../assets/assetManager';

export const SelectedAsset = new Observable<AssetDefinitionEditor | null>(null);

export function LayerUI() {
	const selectedAsset = useObservable(SelectedAsset);

	if (!selectedAsset) {
		return (
			<div>
				<h3>Select an asset to edit layers</h3>
			</div>
		);
	}

	return <div>Layers</div>;
}
