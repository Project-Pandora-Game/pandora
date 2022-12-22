import classNames from 'classnames';
import { AssetGraphicsDefinition, AssetGraphicsDefinitionSchema, GetLogger, ZodMatcher } from 'pandora-common';
import React, { ReactElement, useState, useSyncExternalStore } from 'react';
import { toast } from 'react-toastify';
import { AssetGraphicsLayer, useLayerHasAlphaMasks, useLayerName } from '../../../assets/assetGraphics';
import { useEvent } from '../../../common/useEvent';
import { Button } from '../../../components/common/button/button';
import { Scrollbar } from '../../../components/common/scrollbar/scrollbar';
import { ContextHelpButton } from '../../../components/help/contextHelpButton';
import { StripAssetIdPrefix } from '../../../graphics/utility';
import { useObservable } from '../../../observable';
import { TOAST_OPTIONS_ERROR } from '../../../persistentToast';
import { EDITOR_ALPHA_ICONS, useEditorAssetLayers } from '../../editor';
import { useEditor } from '../../editorContextProvider';
import { EditorAssetGraphics } from '../../graphics/character/appearanceEditor';
import './asset.scss';

const IsAssetGraphicsDefinition = ZodMatcher(AssetGraphicsDefinitionSchema);

export function AssetUI() {
	const editor = useEditor();
	const selectedAsset = useObservable(editor.targetAsset);

	if (!selectedAsset) {
		return (
			<div className='editor-setupui'>
				<h3>Select an asset to edit layers</h3>
			</div>
		);
	}

	return (
		<Scrollbar color='lighter' className='editor-setupui editor-assetui slim'>
			<h3>
				Editing: { StripAssetIdPrefix(selectedAsset.id) }
				<ContextHelpButton>
					<p>
						The &quot;Asset&quot;-tab lets you edit, export, and import a single asset, as well as manage<br />
						its layers and the images used by the asset.
					</p>
					<p>
						The first line shows you which asset you are currently editing.<br />
						Next are buttons that allow you to export and import the graphics definition of the<br />
						current asset. It is in a &quot;graphics.json&quot; file that every asset needs to have, as it<br />
						is used in the asset code to define how the asset is displayed.<br />
						After editing the asset as desired, you can export the result as a zip file containing<br />
						the &quot;graphics.json&quot; file and your images. This zip needs to be extracted and its contents<br />
						placed in the same folder as the &quot;*.asset.ts&quot; file.
					</p>
					<p>
						You can also import the &quot;graphics.json&quot; file again, at any time, after selecting the fitting<br />
						asset for editing under the &quot;Items&quot;-tab.<br />
						This allows you to continue working on an asset at a later point in time by importing a<br />
						previously exported intermediate editor state, independent of whether you finished the asset<br />
						completely or you stopped earlier and exported your current progress as &quot;graphics.json&quot; file.
					</p>
					<p>
						Beneath the &quot;Unselect layer&quot;-button is the layer management section.<br />
						There, you can either add new layers or select any existing ones by clicking on the<br />
						layer name, which highlights it to show that it is selected.<br />
						A layer must be selected in order to edit it in the &quot;Layer&quot;-tab.
					</p>
					<p>
						The order of layers in the list on this tab is NOT purely cosmetic for just the editor but also<br />
						affects the priority of a layer in comparison to the other layers of the same asset:<br />
						The higher up a layer is shown here, the closer to the body it is.<br />
						An incorrect layer order can be spotted by visual inconsistencies in the &quot;Preview&quot;-tab.
					</p>
					Moreover, there are a few buttons for each layer, such as:
					<ul>
						<li>
							The &quot;arrow&quot;-button allows changing the order of each layer in the editor list.
						</li>
						<li>
							The &quot;square&quot;-button lets you cycle the layer between solid, transparent, and invisible.
						</li>
						<li>
							The &quot;trash bin&quot;-button deletes a layer.
						</li>
					</ul>
				</ContextHelpButton>
			</h3>
			<AssetExportImport asset={ selectedAsset } />
			<AssetLayerList asset={ selectedAsset } />
			<Button onClick={ () => {
				selectedAsset.addLayer();
			} }>
				Add layer
			</Button>
			<h4>
				Image management
				<ContextHelpButton>
					<p>
						This section allows you to add or remove images (*.PNG) that you want to use in any of<br />
						the layers of this asset. Clicking the &quot;+&quot;-button next to an image will toggle<br />
						a preview of the picture.
					</p>
					<b>Note:</b> After importing a &quot;graphics.json&quot; file, you may have to add all image<br />
					files of the asset once more manually.<br />
					<b>Note:</b> You can add multiple images at once.
				</ContextHelpButton>
			</h4>
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
			<AssetImageList asset={ selectedAsset } />
		</Scrollbar>
	);
}

function AssetExportImport({ asset }: { asset: EditorAssetGraphics; }): ReactElement {
	return (
		<div className='exportImport'>
			<Button onClick={ () => void asset.downloadZip() } className='flex-2' >Export</Button>
			<label htmlFor='asset-import-button' className='flex-1 hiddenUpload'>
				<input
					accept='application/json'
					id='asset-import-button'
					type='file'
					onChange={ (e) => {
						const files = e.target.files;
						if (files && files.length === 1) {
							const file = files.item(0);
							if (!file || !file.name.endsWith('.json'))
								return;
							file
								.text()
								.then((content) => {
									const definition = JSON.parse(
										content
											.split('\n')
											.filter((line) => !line.trimStart().startsWith('//'))
											.join('\n'),
									) as AssetGraphicsDefinition;
									if (!IsAssetGraphicsDefinition(definition)) {
										throw new Error('Invalid format');
									}
									asset.load(definition);
								})
								.catch((err) => {
									toast(`Import failed:\n${String(err)}`, TOAST_OPTIONS_ERROR);
									GetLogger('AssetImport').error(err);
								});
						}
					} }
				/>
				<span className='Button default'>
					Import
				</span>
			</label>
		</div>
	);
}

function AssetLayerList({ asset }: { asset: EditorAssetGraphics; }): ReactElement {
	const editor = useEditor();
	const layers = useEditorAssetLayers(asset, true);

	return (
		<div className='layerList'>
			<Button onClick={ () => editor.targetLayer.value = null } className='slim' >Unselect layer</Button>
			<ul>
				{ layers.map((layer) => <AssetLayerListLayer key={ `${layer.index}` + (layer.isMirror ? 'm' : '') } asset={ asset } layer={ layer } />) }
			</ul>
		</div>
	);
}

function AssetLayerListLayer({ asset, layer }: { asset: EditorAssetGraphics; layer: AssetGraphicsLayer; }): ReactElement {
	const editor = useEditor();
	const isSelected = useObservable(editor.targetLayer) === layer;

	const alphaIndex = useSyncExternalStore<number>((changed) => {
		return editor.on('layerOverrideChange', (changedLayer) => {
			if (changedLayer === layer) {
				changed();
			}
		});
	}, () => editor.getLayersAlphaOverrideIndex(layer));

	const hasAlphaMasks = useLayerHasAlphaMasks(layer);

	const toggleAlpha = (event: React.MouseEvent<HTMLElement>) => {
		event.stopPropagation();
		editor.setLayerAlphaOverride([layer], alphaIndex+1);
	};

	const name = useLayerName(layer);

	return (
		<li className={ isSelected ? 'selected' : '' }>
			<button
				className={ classNames('layerName', { alphaMaskLayer: hasAlphaMasks }) }
				onClick={ () => editor.targetLayer.value = layer }
			>
				{ name }
			</button>
			<Button className='slim hideDisabled' aria-label='move' disabled={ layer.isMirror } onClick={ () => asset.moveLayerRelative(layer, -1) } title='Move layer up'>
				🠉
			</Button>
			<Button className='slim' aria-label='hide' onClick={ toggleAlpha } title="Cycle layers's opacity">
				{EDITOR_ALPHA_ICONS[alphaIndex]}
			</Button>
			<Button className='slim hideDisabled' aria-label='delete' disabled={ layer.isMirror } onClick={ () => {
				if (!confirm(`Delete layer '${name}'?`))
					return;
				asset.deleteLayer(layer);
			} } title='DELETE this layer'>
				🗑️
			</Button>
		</li>
	);
}

function AssetImageList({ asset }: { asset: EditorAssetGraphics; }): ReactElement {
	const editor = useEditor();
	const imageList = useSyncExternalStore(editor.getSubscriber('modifiedAssetsChange'), () => asset.loadedTextures);

	const elements: ReactElement[] = [];

	for (const image of imageList) {
		elements.push(<AssetImageLi key={ image } image={ image } asset={ asset } />);
	}
	return (
		<div className='assetImageList'>
			<ul>
				{ elements }
			</ul>
		</div>
	);
}

function AssetImageLi({ image, asset }: { image: string; asset: EditorAssetGraphics; }): ReactElement {
	const [preview, setPreview] = useState<string>('');

	const onTogglePreview = useEvent(() => {
		setPreview(preview ? '' : asset.getTextureImageSource(image) ?? '');
	});

	const onDelete = useEvent((event: React.MouseEvent<HTMLElement>) => {
		event.stopPropagation();
		if (!confirm(`Delete image '${image}'?`))
			return;

		asset.deleteTexture(image);
	});

	return (
		<>
			<li>
				<Button className='slim' aria-label='delete' onClick={ onTogglePreview } title='Toggle preview'>
					{ preview ? '-' : '+' }
				</Button>
				<span className='imageName'>{ image }</span>
				<Button className='slim' aria-label='delete' onClick={ onDelete } title='DELETE this image'>
					🗑️
				</Button>
			</li>
			{ preview && (
				<li key={ `${image}-preview` } className='preview'>
					<img src={ preview } alt='' />
				</li>
			) }
		</>
	);
}
