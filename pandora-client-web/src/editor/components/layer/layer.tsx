import { produce, type Immutable } from 'immer';
import { noop } from 'lodash-es';
import { Assert, AssertNever, type GraphicsSourceLayer, type GraphicsSourceRoomDeviceLayer } from 'pandora-common';
import { ReactElement, useCallback } from 'react';
import deleteIcon from '../../../assets/icons/delete.svg';
import editIcon from '../../../assets/icons/edit.svg';
import { TextInput } from '../../../common/userInteraction/input/textInput.tsx';
import { Column, Row } from '../../../components/common/container/container.tsx';
import { useConfirmDialog } from '../../../components/dialog/dialog.tsx';
import { ContextHelpButton } from '../../../components/help/contextHelpButton.tsx';
import { StripAssetIdPrefix } from '../../../graphics/utility.ts';
import { useObservable } from '../../../observable.ts';
import { useLayerName } from '../../assets/editorAssetCalculationHelpers.ts';
import { EditorAssetGraphicsRoomDeviceLayerContainer, type EditorAssetGraphicsRoomDeviceLayer } from '../../assets/editorAssetGraphicsRoomDeviceLayer.ts';
import { EditorAssetGraphicsWornLayerContainer, type EditorAssetGraphicsWornLayer } from '../../assets/editorAssetGraphicsWornLayer.ts';
import { useEditor } from '../../editorContextProvider.tsx';
import './layer.scss';
import { LayerAutoMeshUI } from './layerAutoMesh.tsx';
import { LayerMeshUI } from './layerMesh.tsx';
import { LayerRoomDeviceMeshUI } from './layerRoomDeviceMesh.tsx';
import { LayerRoomDeviceSlotUI } from './layerRoomDeviceSlot.tsx';
import { LayerRoomDeviceSpriteUI } from './layerRoomDeviceSprite.tsx';
import { LayerRoomDeviceTextUI } from './layerRoomDeviceText.tsx';
import { LayerTextUI } from './layerText.tsx';

export function LayerUI(): ReactElement {
	const editor = useEditor();
	const selectedAsset = useObservable(editor.targetAsset);
	const selectedLayer = useObservable(editor.targetLayer);
	const asset = selectedLayer?.assetGraphics ?? selectedAsset;

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
	Assert(asset === selectedLayer.assetGraphics);

	return (
		<div className='editor-setupui' key={ `${asset.id}/${selectedLayer.index}` }>
			<LayerName layer={ selectedLayer } />
			<LayerQuickActions layer={ selectedLayer } />
			{ (selectedLayer instanceof EditorAssetGraphicsWornLayerContainer) ? (
				(selectedLayer.type === 'mesh' || selectedLayer.type === 'alphaImageMesh') ? (
					<LayerMeshUI layer={ selectedLayer } />
				) :
				(selectedLayer.type === 'autoMesh') ? (
					<LayerAutoMeshUI layer={ selectedLayer } />
				) :
				(selectedLayer.type === 'text') ? (
					<LayerTextUI layer={ selectedLayer } />
				) :
				AssertNever(selectedLayer)
			) : (selectedLayer instanceof EditorAssetGraphicsRoomDeviceLayerContainer) ? (
				(selectedLayer.type === 'slot') ? (
					<LayerRoomDeviceSlotUI layer={ selectedLayer } />
				) :
				(selectedLayer.type === 'sprite') ? (
					<LayerRoomDeviceSpriteUI layer={ selectedLayer } />
				) :
				(selectedLayer.type === 'mesh') ? (
					<LayerRoomDeviceMeshUI layer={ selectedLayer } />
				) :
				(selectedLayer.type === 'text') ? (
					<LayerRoomDeviceTextUI layer={ selectedLayer } />
				) :
				AssertNever(selectedLayer)
			) : (
				AssertNever(selectedLayer)
			) }
		</div>
	);
}

function LayerName({ layer }: { layer: EditorAssetGraphicsWornLayer | EditorAssetGraphicsRoomDeviceLayer; }): ReactElement | null {
	const visibleName = useLayerName(layer);
	const { name } = useObservable<Immutable<GraphicsSourceLayer> | Immutable<GraphicsSourceRoomDeviceLayer>>(layer.definition);

	return (
		<>
			<h3>
				Editing: { StripAssetIdPrefix(layer.assetGraphics.id) } &gt; { visibleName }
				<ContextHelpButton>
					The "Layer"-tab lets you edit a layer of an asset by configuring various properties of the layer.<br />
					The first line shows you the name of the asset and asset layer you are currently editing.<br />
					[category/asset-name] &gt; [layer-name]
				</ContextHelpButton>
			</h3>
			<Row alignY='center'>
				<span>
					Layer type:
				</span>
				{ (layer instanceof EditorAssetGraphicsWornLayerContainer) ? (
					(layer.type === 'mesh') ? (
						<span>Image</span>
					) :
					(layer.type === 'alphaImageMesh') ? (
						<span>Alpha image</span>
					) :
					(layer.type === 'autoMesh') ? (
						<span>Automatic image</span>
					) :
					(layer.type === 'text') ? (
						<span>Text</span>
					) :
					AssertNever(layer)
				) : (layer instanceof EditorAssetGraphicsRoomDeviceLayerContainer) ? (
					(layer.type === 'slot') ? (
						<span>Character slot</span>
					) :
					(layer.type === 'sprite') ? (
						<span>Simple image</span>
					) :
					(layer.type === 'mesh') ? (
						<span>Custom mesh</span>
					) :
					(layer.type === 'text') ? (
						<span>Text</span>
					) :
					AssertNever(layer)
				) : (
					AssertNever(layer)
				) }
			</Row>
			<Column gap='tiny'>
				<Row alignY='center'>
					<label htmlFor='layer-name'>
						Layer name:
					</label>
					<ContextHelpButton>
						This field sets the layer's name, as shown in the "Asset"-tab.<br />
						It affects nothing else and is purely for identifying layers later on.
					</ContextHelpButton>
				</Row>
				<TextInput
					id='layer-name'
					value={ name ?? '' }
					onChange={ (newValue) => {
						layer.setName(newValue.trim());
					} }
				/>
			</Column>
		</>
	);
}

function LayerQuickActions({ layer }: {
	layer: EditorAssetGraphicsWornLayer | EditorAssetGraphicsRoomDeviceLayer;
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
				if (layer instanceof EditorAssetGraphicsWornLayerContainer) {
					layer.container.deleteLayer(layer);
				} else if (layer instanceof EditorAssetGraphicsRoomDeviceLayerContainer) {
					layer.assetGraphics.deleteLayer(layer);
				} else {
					AssertNever(layer);
				}
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
		if (layer instanceof EditorAssetGraphicsWornLayerContainer) {
			const copy = produce(layer.definition.value, (d) => {
				d.name = newName;
			});
			editor.targetLayer.value = layer.container.addLayer(copy, layer.index + 1);
		} else if (layer instanceof EditorAssetGraphicsRoomDeviceLayerContainer) {
			const copy = produce(layer.definition.value, (d) => {
				d.name = newName;
			});
			editor.targetLayer.value = layer.assetGraphics.addLayer(copy, layer.index + 1);
		} else {
			AssertNever(layer);
		}
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
