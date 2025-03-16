import classNames from 'classnames';
import { AssetSourceGraphicsDefinitionSchema, GetLogger } from 'pandora-common';
import React, { ReactElement, useCallback, useState, useSyncExternalStore } from 'react';
import { toast } from 'react-toastify';
import { useEvent } from '../../../common/useEvent.ts';
import { Button } from '../../../components/common/button/button.tsx';
import { Column, Row } from '../../../components/common/container/container.tsx';
import { ModalDialog } from '../../../components/dialog/dialog.tsx';
import { ContextHelpButton } from '../../../components/help/contextHelpButton.tsx';
import { StripAssetIdPrefix } from '../../../graphics/utility.ts';
import { useObservable } from '../../../observable.ts';
import { TOAST_OPTIONS_ERROR, TOAST_OPTIONS_SUCCESS } from '../../../persistentToast.ts';
import { useLayerHasAlphaMasks, useLayerName } from '../../assets/editorAssetCalculationHelpers.ts';
import type { EditorAssetGraphics } from '../../assets/editorAssetGraphics.ts';
import type { EditorAssetGraphicsLayer } from '../../assets/editorAssetGraphicsLayer.ts';
import { EDITOR_ALPHA_ICONS } from '../../editor.tsx';
import { useEditor } from '../../editorContextProvider.tsx';
import './asset.scss';

export function AssetUI() {
	const editor = useEditor();
	const selectedAsset = useObservable(editor.targetAsset);
	const [showAddLayer, setShowAddLayer] = useState(false);

	if (!selectedAsset) {
		return (
			<div className='editor-setupui'>
				<h3>Select an asset to edit layers</h3>
			</div>
		);
	}

	return (
		<div className='editor-setupui editor-assetui'>
			<h3>
				Editing: { StripAssetIdPrefix(selectedAsset.id) }
				<ContextHelpButton>
					<p>
						The "Asset"-tab lets you edit, export, and import a single asset, as well as manage<br />
						its layers and the images used by the asset.
					</p>
					<p>
						The first line shows you which asset you are currently editing.<br />
						Next are buttons that allow you to export and import the graphics definition of the<br />
						current asset. It is in a "graphics.json" file that every asset needs to have, as it<br />
						is used in the asset code to define how the asset is displayed.<br />
						After editing the asset as desired, you can export the result as a zip file containing<br />
						the "graphics.json" file and your images. This zip needs to be extracted and its contents<br />
						placed in the same folder as the "*.asset.ts" file.
					</p>
					<p>
						You can also import the "graphics.json" file again, at any time, after selecting the fitting<br />
						asset for editing under the "Items"-tab.<br />
						This allows you to continue working on an asset at a later point in time by importing a<br />
						previously exported intermediate editor state, independent of whether you finished the asset<br />
						completely or you stopped earlier and exported your current progress as "graphics.json" file.
					</p>
					<p>
						Beneath the "Unselect layer"-button is the layer management section.<br />
						There, you can either add new layers or select any existing ones by clicking on the<br />
						layer name, which highlights it to show that it is selected.<br />
						A layer must be selected in order to edit it in the "Layer"-tab.
					</p>
					<p>
						The order of layers in the list on this tab is NOT purely cosmetic for just the editor but also<br />
						affects the priority of a layer in comparison to the other layers of the same asset:<br />
						The higher up a layer is shown here, the closer to the body it is.<br />
						An incorrect layer order can be spotted by visual inconsistencies in the "Preview"-tab.
					</p>
					Moreover, there are a few buttons for each layer, such as:
					<ul>
						<li>
							The "arrow"-button allows changing the order of each layer in the editor list.
						</li>
						<li>
							The "square"-button lets you cycle the layer between solid, transparent, and invisible.
						</li>
						<li>
							The "trash bin"-button deletes a layer.
						</li>
					</ul>
				</ContextHelpButton>
			</h3>
			<AssetExportImport asset={ selectedAsset } />
			<AssetLayerList asset={ selectedAsset } />
			<Button onClick={ () => {
				setShowAddLayer(true);
			} }>
				Add layer
			</Button>
			{
				showAddLayer ? (
					<AddLayerUiDialog
						close={ () => setShowAddLayer(false) }
						selectedAsset={ selectedAsset }
					/>
				) : null
			}
			<h4>
				Image management
				<ContextHelpButton>
					<p>
						This section allows you to add or remove images (*.PNG) that you want to use in any of<br />
						the layers of this asset. Clicking the "+"-button next to an image will toggle<br />
						a preview of the picture.
					</p>
					<b>Note:</b> After importing a "graphics.json" file, you may have to add all image<br />
					files of the asset once more manually.<br />
					<b>Note:</b> You can add multiple images at once.
				</ContextHelpButton>
			</h4>
			<label htmlFor='upload-button' className='hiddenUpload'>
				{ /* eslint-disable-next-line react/forbid-elements */ }
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
		</div>
	);
}

function AddLayerUiDialog({ close, selectedAsset }: { close: () => void; selectedAsset: EditorAssetGraphics; }): ReactElement {
	return (
		<ModalDialog>
			<Column>
				<Button onClick={ () => {
					selectedAsset.addLayer('mesh');
					close();
				} }>
					Add image layer
				</Button>
				<Button onClick={ () => {
					selectedAsset.addLayer('alphaImageMesh');
					close();
				} }>
					Add alpha image layer
				</Button>
				<hr className='fill-x' />
				<Button onClick={ () => {
					close();
				} }>
					Cancel
				</Button>
			</Column>
		</ModalDialog>
	);
}

function AssetExportImport({ asset }: { asset: EditorAssetGraphics; }): ReactElement {
	const exportToClipboard = useCallback(() => {
		asset.exportDefinitionToClipboard()
			.then(() => {
				toast(`Copied to clipboard`, TOAST_OPTIONS_SUCCESS);
			})
			.catch((err) => {
				GetLogger('AssetExportImport').error('Error exporing to clipboard:', err);
				toast(`Error exporting to clipboard:\n${err}`, TOAST_OPTIONS_ERROR);
			});
	}, [asset]);

	return (
		<Column>
			<Button onClick={ () => void asset.downloadZip() } className='flex-2' >Export archive</Button>
			<Row>
				<Button onClick={ exportToClipboard } className='flex-2' >Export definition to clipboard</Button>
				<label htmlFor='asset-import-button' className='flex-1 hiddenUpload'>
					{ /* eslint-disable-next-line react/forbid-elements */ }
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
										const definition = AssetSourceGraphicsDefinitionSchema.parse(JSON.parse(
											content
												.split('\n')
												.filter((line) => !line.trimStart().startsWith('//'))
												.join('\n'),
										));
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
			</Row>
		</Column>
	);
}

function AssetLayerList({ asset }: { asset: EditorAssetGraphics; }): ReactElement {
	const editor = useEditor();
	const layers = useObservable(asset.layers);

	return (
		<div className='layerList'>
			<Button onClick={ () => editor.targetLayer.value = null } className='slim' >Unselect layer</Button>
			<ul>
				{ layers.map((layer, index) => <AssetLayerListLayer key={ index } asset={ asset } layer={ layer } />) }
			</ul>
		</div>
	);
}

function AssetLayerListLayer({ asset, layer }: { asset: EditorAssetGraphics; layer: EditorAssetGraphicsLayer; }): ReactElement {
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
		editor.setLayerAlphaOverride([layer], alphaIndex + 1);
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
			<Button className='slim hideDisabled' aria-label='move' onClick={ () => asset.moveLayerRelative(layer, -1) } title='Move layer up'>
				🠉
			</Button>
			<Button className='slim' aria-label='hide' onClick={ toggleAlpha } title="Cycle layers's opacity">
				{ EDITOR_ALPHA_ICONS[alphaIndex] }
			</Button>
			<Button className='slim hideDisabled' aria-label='delete' onClick={ () => {
				// eslint-disable-next-line no-alert
				if (!confirm(`Are you sure you want to delete layer '${name}'?`))
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
		// eslint-disable-next-line no-alert
		if (!confirm(`Are you sure you want to delete image '${image}'?`))
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
