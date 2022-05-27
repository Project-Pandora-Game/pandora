import React, { ReactElement, useSyncExternalStore } from 'react';
import { toast } from 'react-toastify';
import { AssetGraphicsLayer } from '../../../assets/assetGraphics';
import { Button } from '../../../components/common/Button/Button';
import { StripAssetIdPrefix } from '../../../graphics/utility';
import { useObservable } from '../../../observable';
import { TOAST_OPTIONS_ERROR } from '../../../persistentToast';
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
			<h3>Editing: { StripAssetIdPrefix(selectedAsset.id) }</h3>
			<AssetLayerList editor={ editor } asset={ selectedAsset } />
			<Button onClick={ () => {
				selectedAsset.addLayer();
			} }>
				Add layer
			</Button>
			<h4>IMAGE ASSET MANAGEMENT</h4>
			<label htmlFor='upload-button' className='hiddenUpload'>
				<input
					accept='image/png'
					id='upload-button'
					multiple
					type='file'
					onChange={ (e) => {
						if (e.target.files) {
							selectedAsset
								.addTexturesFromFiles(e.target.files)
								.catch((err) => {
									toast(`Load failed: \n${String(err)}`, TOAST_OPTIONS_ERROR);
								});
						}
					} }
				/>
				<span className='Button default'>
					Add image
				</span>
			</label>
			<AssetImageList editor={ editor } asset={ selectedAsset } />
		</div>
	);
}

function AssetLayerList({ editor, asset }: { editor: Editor; asset: EditorAssetGraphics; }): ReactElement {
	const layers = useEditorAssetLayers(asset, true);

	return (
		<div className='layerList'>
			<Button onClick={ () => editor.targetLayer.value = null } className='slim' >Unselect layer</Button>
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
			<Button className='slim hideDisabled' aria-label='move' disabled={ layer.isMirror } onClick={ () => asset.moveLayerRelative(layer, -1) } title='Move layer up'>
				🠉
			</Button>
			<Button className='slim' aria-label='hide' onClick={ toggleAlpha } title="Cycle layers's opacity">
				{EDITOR_ALPHA_ICONS[alphaIndex]}
			</Button>
			<Button className='slim hideDisabled' aria-label='delete' disabled={ layer.isMirror } onClick={ () => {
				if (!confirm(`Delete layer '${layer.name}'?`))
					return;
				asset.deleteLayer(layer);
			} } title='DELETE this layer'>
				🗑️
			</Button>
		</li>
	);
}

function AssetImageList({ editor, asset }: { editor: Editor; asset: EditorAssetGraphics; }): ReactElement {
	const imageList = useSyncExternalStore(editor.getSubscriber('modifiedAssetsChange'), () => asset.loadedTextures);

	const elements: ReactElement[] = [];

	for (const image of imageList) {
		elements.push(
			<li key={ image }>
				<span className='imageName'>{image.replace(/\.png$/i, '')}</span>
				<Button className='slim' aria-label='delete' onClick={ () => {
					if (!confirm(`Delete image '${image}'?`))
						return;
					asset.deleteTexture(image);
				} } title='DELETE this image'>
					🗑️
				</Button>
			</li>,
		);
	}
	return (
		<div className='assetImageList'>
			<ul>
				{ elements }
			</ul>
		</div>
	);
}
