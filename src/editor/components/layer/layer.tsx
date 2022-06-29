import { LayerPriority, LAYER_PRIORITIES } from 'pandora-common';
import React, { ReactElement, useCallback, useState, useSyncExternalStore } from 'react';
import { AssetGraphicsLayer } from '../../../assets/assetGraphics';
import { GetAssetManager } from '../../../assets/assetManager';
import { Button } from '../../../components/common/Button/Button';
import { FAKE_BONES } from '../../../graphics/graphicsCharacter';
import { StripAssetIdPrefix } from '../../../graphics/utility';
import { useObservable } from '../../../observable';
import { useEditor } from '../../editorContextProvider';
import { EditorAssetGraphics } from '../../graphics/character/appearanceEditor';
import { ParseLayerImageOverrides, SerializeLayerImageOverrides } from '../../parsing';
import './layer.scss';

export function LayerUI(): ReactElement {
	const editor = useEditor();
	const selectedLayer = useObservable(editor.targetLayer);
	const asset = selectedLayer?.asset;

	if (!selectedLayer || !asset || !(asset instanceof EditorAssetGraphics)) {
		return (
			<div>
				<h3>Select an layer to edit it</h3>
			</div>
		);
	}

	return (
		<div className='editor-layerui'>
			<LayerName layer={ selectedLayer } />
			<LayerImageSelect layer={ selectedLayer } asset={ asset } />
			<ColorPicker layer={ selectedLayer } asset={ asset } />
			<LayerPrioritySelect layer={ selectedLayer } asset={ asset } />
			<LayerPointsFilterEdit layer={ selectedLayer } />
			<LayerImageOverridesTextarea layer={ selectedLayer } />
		</div>
	);
}

function LayerName({ layer }: { layer: AssetGraphicsLayer }): ReactElement | null {
	const layerName = useSyncExternalStore(layer.getSubscriber('change'), () => layer.definition.name ?? '');

	return (
		<>
			<h3>Editing: { StripAssetIdPrefix(layer.asset.id) } &gt; {layer.name}</h3>
			<div>
				<label htmlFor='layer-name'>Layer name:</label>
				<input
					type='text'
					id='layer-name'
					className='flex'
					value={ layerName }
					onChange={ (event) => {
						const l = layer.mirror && layer.isMirror ? layer.mirror : layer;
						l.definition.name = event.target.value || undefined;
						l.onChange();
					} }
				/>
			</div>
		</>
	);
}

function LayerImageSelect({ layer, asset }: { layer: AssetGraphicsLayer; asset: EditorAssetGraphics; }): ReactElement | null {
	const imageList = useSyncExternalStore(asset.editor.getSubscriber('modifiedAssetsChange'), () => asset.loadedTextures);
	const layerImage = useSyncExternalStore(layer.getSubscriber('change'), () => layer.definition.image);

	const elements: ReactElement[] = [<option value='' key=''>[ None ]</option>];
	for (const image of imageList) {
		elements.push(
			<option value={ image } key={ image }>{ image }</option>,
		);
	}

	return (
		<div>
			<label htmlFor='layer-image-select'>Layer image asset:</label>
			<select
				id='layer-image-select'
				className='flex'
				value={ layerImage }
				onChange={ (event) => {
					layer.setImage(event.target.value);
				} }
			>
				{ elements }
			</select>
		</div>
	);
}

function ColorPicker({ layer, asset }: { layer: AssetGraphicsLayer; asset: EditorAssetGraphics; }): ReactElement | null {
	const editor = asset.editor;

	const tint = useSyncExternalStore<number>((changed) => {
		return editor.on('layerOverrideChange', (changedLayer) => {
			if (changedLayer === layer) {
				changed();
			}
		});
	}, () => editor.getLayerTint(layer));

	return (
		<div>
			<label htmlFor='layer-tint'>Layer tint:</label>
			<input
				type='color'
				className='flex'
				id='layer-tint'
				value={ '#' + tint.toString(16).padStart(6, '0') }
				onChange={ (event) => {
					editor.setLayerTint(layer, Number.parseInt(event.target.value.replace(/^#/, ''), 16));
				} }
			/>
			<Button className='slim' onClick={ () => editor.setLayerTint(layer, 0xffffff) } >↺</Button>
		</div>
	);
}

function LayerPrioritySelect({ layer, asset }: { layer: AssetGraphicsLayer; asset: EditorAssetGraphics; }): ReactElement | null {
	const layerPriority = useSyncExternalStore(layer.getSubscriber('change'), () => layer.definition.priority);

	const elements: ReactElement[] = [];

	for (const priority of LAYER_PRIORITIES) {
		elements.push(
			<option value={ priority } key={ priority }>{ priority }</option>,
		);
	}

	return (
		<div>
			<label htmlFor='layer-priority-select'>Layer priority type:</label>
			<select
				id='layer-priority-select'
				className='flex'
				value={ layerPriority }
				onChange={ (event) => {
					asset.setLayerPriority(layer, event.target.value as LayerPriority);
				} }
			>
				{ elements }
			</select>
		</div>
	);
}

function LayerPointsFilterEdit({ layer }: { layer: AssetGraphicsLayer }): ReactElement | null {
	const [value, setValue] = useState(layer.definition.pointType?.join(',') ?? '');

	const onChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setValue(e.target.value);
		layer.setPointType(
			e.target.value
				.split(',')
				.map((t) => t.trim())
				.filter((t) => !!t),
		);
	}, [layer]);

	return (
		<div>
			<div>Point type filter (comma separated):</div>
			<textarea
				spellCheck='false'
				aria-label='layer points filter'
				value={ value }
				onChange={ onChange }
			/>
		</div>
	);
}

function LayerImageOverridesTextarea({ layer }: { layer: AssetGraphicsLayer }): ReactElement | null {
	const [value, setValue] = useState(SerializeLayerImageOverrides(layer.definition.imageOverrides));
	const [error, setError] = useState<string | null>(null);

	const onChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setValue(e.target.value);
		try {
			const result = ParseLayerImageOverrides(e.target.value, GetAssetManager().getAllBones().map((b) => b.name).concat(FAKE_BONES));
			setError(null);
			layer.setImageOverrides(result);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		}

	}, [layer]);

	return (
		<div>
			<div>Image overrides:</div>
			<textarea
				spellCheck='false'
				rows={ 6 }
				value={ value }
				onChange={ onChange }
			/>
			{ error != null && <div className='error'>{ error }</div> }
		</div>
	);
}
