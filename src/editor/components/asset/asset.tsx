import React, { ReactElement, useSyncExternalStore } from 'react';
import { AssetGraphicsLayer } from '../../../assets/assetGraphics';
import { Button } from '../../../components/common/Button/Button';
import { useObservable } from '../../../observable';
import { Editor, EDITOR_ALPHA_ICONS, useEditorAssetLayers } from '../../editor';
import { EditorAssetGraphics } from '../../graphics/character/appearanceEditor';
import './asset.scss';

export function AssetUI({ editor }: { editor: Editor }) {
	const selectedAsset = useObservable(editor.targetAsset);

	if (!selectedAsset) {
		return (
			<div>
				<h3>Select an asset to edit layers</h3>
			</div>
		);
	}

	return (
		<div className='editor-assetui'>
			<AssetLayerList editor={ editor } asset={ selectedAsset } />
			<Button onClick={ () => {
				selectedAsset.addLayer();
			} }>
				Add layer
			</Button>
		</div>
	);
}

function AssetLayerList({ editor, asset }: { editor: Editor; asset: EditorAssetGraphics; }): ReactElement {
	const layers = useEditorAssetLayers(asset, true);

	return (
		<div className='layerList'>
			<Button onClick={ () => editor.targetLayer.value = null } >Unselect layer</Button>
			<ul>
				{ layers.map((layer) => <AssetLayerListLayer key={ `${layer.index}` + (layer.isMirror ? 'm' : '') } editor={ editor } asset={ asset } layer={ layer } />) }
			</ul>
		</div>
	);
}

function AssetLayerListLayer({ editor, asset, layer }: { editor: Editor; asset: EditorAssetGraphics; layer: AssetGraphicsLayer; }): ReactElement {
	const isSelected = useObservable(editor.targetLayer) === layer;

	const alphaIndex = useSyncExternalStore<number>((changed) => {
		return editor.on('layerOverrideChange', (changedLayer) => {
			if (changedLayer === layer) {
				changed();
			}
		});
	}, () => editor.getLayersAlphaOverrideIndex(layer));

	const toggleAlpha = (event: React.MouseEvent<HTMLElement>) => {
		event.stopPropagation();
		editor.setLayerAlphaOverride([layer], alphaIndex+1);
	};

	return (
		<li className={ isSelected ? 'selected' : '' }>
			<button
				className='layerName'
				onClick={ () => editor.targetLayer.value = layer }
			>
				{ layer.name }
			</button>
			<Button className='slim hideDisabled' aria-label='move' disabled={ layer.isMirror } onClick={ () => asset.moveLayerRelative(layer, -1) }>
				🠉
			</Button>
			<Button className='slim' aria-label='hide' onClick={ toggleAlpha }>
				{EDITOR_ALPHA_ICONS[alphaIndex]}
			</Button>
			<Button className='slim hideDisabled' aria-label='delete' disabled={ layer.isMirror } onClick={ () => {
				if (!confirm(`Delete layer '${layer.name}'?`))
					return;
				asset.removeLayer(layer);
			} }>
				🗑️
			</Button>
		</li>
	);
}
