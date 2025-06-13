import { produce, type Immutable } from 'immer';
import { noop } from 'lodash-es';
import { Assert, AssertNever, type GraphicsSourceLayer } from 'pandora-common';
import { ReactElement, useCallback } from 'react';
import deleteIcon from '../../../assets/icons/delete.svg';
import editIcon from '../../../assets/icons/edit.svg';
import { TextInput } from '../../../common/userInteraction/input/textInput.tsx';
import { Row } from '../../../components/common/container/container.tsx';
import { useConfirmDialog } from '../../../components/dialog/dialog.tsx';
import { ContextHelpButton } from '../../../components/help/contextHelpButton.tsx';
import { StripAssetIdPrefix } from '../../../graphics/utility.ts';
import { useObservable } from '../../../observable.ts';
import { useLayerName } from '../../assets/editorAssetCalculationHelpers.ts';
import { type EditorAssetGraphicsLayer } from '../../assets/editorAssetGraphicsLayer.ts';
import { useEditor } from '../../editorContextProvider.tsx';
import './layer.scss';
import { LayerAutoMeshUI } from './layerAutoMesh.tsx';
import { LayerMeshUI } from './layerMesh.tsx';
import { LayerTextUI } from './layerText.tsx';

export function LayerUI(): ReactElement {
	const editor = useEditor();
	const selectedAsset = useObservable(editor.targetAsset);
	const selectedLayer = useObservable(editor.targetLayer);
	const asset = selectedLayer?.asset ?? selectedAsset;

	if (!asset) {
		return (
			<div className='editor-setupui'>
				<h3>Select an asset to edit layers</h3>
			</div>
		);
	}
	if (!selectedLayer) {
		return (
			<div className='editor-setupui'>
				<h3>Select an layer to edit it</h3>
			</div>
		);
	}
	Assert(asset === selectedLayer.asset);

	return (
		<div className='editor-setupui' key={ `${asset.id}/${selectedLayer.index}` }>
			<LayerName layer={ selectedLayer } />
			<LayerQuickActions layer={ selectedLayer } />
			{
				(selectedLayer.type === 'mesh' || selectedLayer.type === 'alphaImageMesh') ? (
					<LayerMeshUI asset={ asset } layer={ selectedLayer } />
				) :
				(selectedLayer.type === 'autoMesh') ? (
					<LayerAutoMeshUI asset={ asset } layer={ selectedLayer } />
				) :
				(selectedLayer.type === 'text') ? (
					<LayerTextUI layer={ selectedLayer } />
				) :
				AssertNever(selectedLayer)
			}
		</div>
	);
}

function LayerName({ layer }: { layer: EditorAssetGraphicsLayer; }): ReactElement | null {
	const visibleName = useLayerName(layer);
	const { name } = useObservable<Immutable<GraphicsSourceLayer>>(layer.definition);

	return (
		<>
			<h3>
				Editing: { StripAssetIdPrefix(layer.asset.id) } &gt; { visibleName }
				<ContextHelpButton>
					The "Layer"-tab lets you edit a layer of an asset by configuring various properties of the layer.<br />
					The first line shows you the name of the asset and asset layer you are currently editing.<br />
					[category/asset-name] &gt; [layer-name]
				</ContextHelpButton>
			</h3>
			<Row alignY='center'>
				<label htmlFor='layer-name'>
					Layer name:
					<ContextHelpButton>
						This field sets the layer's name, as shown in the "Asset"-tab.<br />
						It affects nothing else and is purely for identifying layers later on.
					</ContextHelpButton>
				</label>
				<TextInput
					id='layer-name'
					className='flex'
					value={ name ?? '' }
					onChange={ (newValue) => {
						layer.setName(newValue.trim());
					} }
				/>
			</Row>
		</>
	);
}

function LayerQuickActions({ layer }: {
	layer: EditorAssetGraphicsLayer;
}): ReactElement | null {
	const editor = useEditor();
	const confirm = useConfirmDialog();
	const name = useLayerName(layer);

	const deleteLayer = useCallback(() => {
		confirm('Confirm deletion', `Are you sure you want to delete layer '${name}'?`)
			.then((result) => {
				if (!result)
					return;

				if (editor.targetLayer.value === layer) {
					editor.targetLayer.value = null;
				}
				layer.asset.deleteLayer(layer);
			})
			.catch(noop);
	}, [editor, confirm, layer, name]);

	const duplicateLayer = useCallback(() => {
		let newName: string;
		const existingNameMatch = /^(.*) \(([0-9]+)\)$/.exec(name);
		if (existingNameMatch != null) {
			newName = `${existingNameMatch[1]} (${Number.parseInt(existingNameMatch[2]) + 1})`;
		} else {
			newName = name + ' (2)';
		}
		const copy = produce(layer.definition.value, (d) => {
			d.name = newName;
		});
		editor.targetLayer.value = layer.asset.addLayer(copy, layer.index + 1);
	}, [editor, layer, name]);

	return (
		<Row>
			<button
				className='wardrobeActionButton allowed'
				onClick={ deleteLayer }
			>
				<img src={ deleteIcon } alt='Delete action' />&nbsp;Delete
			</button>
			<button
				className='wardrobeActionButton allowed'
				onClick={ duplicateLayer }
			>
				<img src={ editIcon } alt='Duplicate action' />&nbsp;Duplicate
			</button>
		</Row>
	);
}
