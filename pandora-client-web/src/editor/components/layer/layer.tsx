import type { Immutable } from 'immer';
import { Assert, AssertNever, type GraphicsSourceLayer } from 'pandora-common';
import { ReactElement } from 'react';
import { TextInput } from '../../../common/userInteraction/input/textInput.tsx';
import { Row } from '../../../components/common/container/container.tsx';
import { ContextHelpButton } from '../../../components/help/contextHelpButton.tsx';
import { StripAssetIdPrefix } from '../../../graphics/utility.ts';
import { useObservable } from '../../../observable.ts';
import { useLayerName } from '../../assets/editorAssetCalculationHelpers.ts';
import { type EditorAssetGraphicsLayer } from '../../assets/editorAssetGraphicsLayer.ts';
import { useEditor } from '../../editorContextProvider.tsx';
import './layer.scss';
import { LayerAutoMeshUI } from './layerAutoMesh.tsx';
import { LayerMeshUI } from './layerMesh.tsx';

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
			{
				(selectedLayer.type === 'mesh' || selectedLayer.type === 'alphaImageMesh') ? (
					<LayerMeshUI asset={ asset } layer={ selectedLayer } />
				) :
				(selectedLayer.type === 'autoMesh') ? (
					<LayerAutoMeshUI asset={ asset } layer={ selectedLayer } />
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
