import { LayerPriority, LAYER_PRIORITIES } from 'pandora-common';
import React, { ReactElement, useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { AssetGraphicsLayer } from '../../../assets/assetGraphics';
import { GetAssetManager } from '../../../assets/assetManager';
import { useEvent } from '../../../common/useEvent';
import { Button } from '../../../components/common/Button/Button';
import { FieldsetToggle } from '../../../components/common/fieldsetToggle';
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
			<ColorPicker layer={ selectedLayer } asset={ asset } />
			<LayerPrioritySelect layer={ selectedLayer } asset={ asset } />
			<LayerPointsFilterEdit layer={ selectedLayer } />
			<hr />
			<LayerImageSelect layer={ selectedLayer } asset={ asset } />
			<LayerImageOverridesTextarea layer={ selectedLayer } />
			<hr />
			<LayerScalingConfig layer={ selectedLayer } asset={ asset } />
			<hr />
			<LayerAlphaMask layer={ selectedLayer } />
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

function LayerImageSelect({ layer, asset, stop }: { layer: AssetGraphicsLayer; asset: EditorAssetGraphics; stop?: number; }): ReactElement | null {
	const imageList = useSyncExternalStore(asset.editor.getSubscriber('modifiedAssetsChange'), () => asset.loadedTextures);
	const layerImage = useSyncExternalStore(layer.getSubscriber('change'), () => layer.getImageSettingsForScalingStop(stop).image);

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
					layer.setImage(event.target.value, stop);
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
			<option value={ priority } key={ priority }>{ GetReadablePriorityName(priority) }</option>,
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

function LayerImageOverridesTextarea({ layer, stop }: { layer: AssetGraphicsLayer; stop?: number; }): ReactElement {
	const [value, setValue] = useState(SerializeLayerImageOverrides(layer.getImageSettingsForScalingStop(stop).overrides));
	const [error, setError] = useState<string | null>(null);

	const onChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setValue(e.target.value);
		try {
			const result = ParseLayerImageOverrides(e.target.value, GetAssetManager().getAllBones().map((b) => b.name).concat(FAKE_BONES));
			setError(null);
			layer.setImageOverrides(result, stop);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		}

	}, [layer, stop]);

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

function LayerScalingConfig({ layer, asset }: { layer: AssetGraphicsLayer; asset: EditorAssetGraphics; }): ReactElement {
	const layerScaling = useSyncExternalStore(layer.getSubscriber('change'), () => layer.definition.scaling);

	const elements: ReactElement[] = [
		<option value='' key=''>[ Nothing ]</option>,
	];

	for (const bone of GetAssetManager().getAllBones()) {
		if (bone.x || bone.y)
			continue;
		elements.push(
			<option value={ bone.name } key={ bone.name }>{ bone.name }</option>,
		);
	}

	return (
		<>
			<div>
				<label htmlFor='layer-scaling-bone-select'>Select image based on value of bone:</label>
				<select
					id='layer-scaling-bone-select'
					className='flex'
					value={ layerScaling?.scaleBone ?? '' }
					onChange={ (event) => {
						asset.setScaleAs(layer, event.target.value);
					} }
				>
					{ elements }
				</select>
			</div>
			{
				layerScaling && <LayerScalingList layer={ layer } asset={ asset } />
			}
		</>
	);
}

function LayerScalingList({ layer, asset }: { layer: AssetGraphicsLayer; asset: EditorAssetGraphics; }): ReactElement | null {
	// TODO: Base on actual stops; right now temporary for breasts
	const possibleStops: [string, number][] = useMemo(() => [
		['flat', -180],
		['small', -150],
		['medium', - 70],
		// ['large', 0],
		['huge', 100],
		['extreme', 180],
	], []);

	const [toAdd, setToAdd] = useState('');

	const scalingStops = useSyncExternalStore(layer.getSubscriber('change'), () => layer.definition.scaling?.stops);

	const optionsToAdd: ReactElement[] = [
		<option value='' key=''></option>,
	];

	for (const stopPoint of possibleStops) {
		if (!scalingStops || scalingStops.some((stop) => stop[0] === stopPoint[1]))
			continue;
		optionsToAdd.push(
			<option value={ stopPoint[0] } key={ stopPoint[0] }>{ stopPoint[0] }</option>,
		);
	}

	const doAdd = () => {
		const addStop = possibleStops.find((stop) => stop[0] === toAdd);
		if (!addStop || !scalingStops || scalingStops.some((stop) => stop[0] === addStop[1]))
			return;
		asset.addScalingStop(layer, addStop[1]);
		setToAdd('');
	};

	return (
		<>
			<div>
				<label htmlFor='layer-scaling-add-point-select'>Add stop point:</label>
				<select
					id='layer-scaling-add-point-select'
					className='flex'
					value={ toAdd }
					onChange={ (event) => {
						setToAdd(event.target.value);
					} }
				>
					{ optionsToAdd }
				</select>
				<Button className='slim' onClick={ doAdd }>Add</Button>
			</div>
			{ scalingStops?.map((stop) => (
				<React.Fragment key={ `${stop[0]}-header` }>
					<div>
						<h3 className='flex-1'>{ possibleStops.find((p) => p[1] === stop[0])?.[0] ?? `${stop[0]}` }</h3>
						<Button className='slim' onClick={ () => asset.removeScalingStop(layer, stop[0]) }>Remove</Button>
					</div>
					<LayerImageSelect layer={ layer } asset={ asset } stop={ stop[0] } />
					<LayerImageOverridesTextarea layer={ layer } stop={ stop[0] } />
				</React.Fragment>
			)) }
		</>
	);
}

function LayerAlphaMask({ layer }: { layer: AssetGraphicsLayer; }): ReactElement {
	const alphaMask = useSyncExternalStore(layer.getSubscriber('change'), () => layer.definition.alphaMask) ?? [];

	const addAlphaMask = useEvent((priority: LayerPriority) => {
		const next: LayerPriority[] = [...new Set(alphaMask).add(priority)].sort();
		layer.setAlphaMask(next);
	});

	const removeAlphaMask = useEvent((priority: LayerPriority) => {
		const set = new Set(alphaMask);
		set.delete(priority);
		const next: LayerPriority[] = [...set].sort();
		if (next.length === 0) {
			layer.setAlphaMask(undefined);
		} else {
			layer.setAlphaMask(next);
		}
	});

	const removeAll = useEvent(() => {
		layer.setAlphaMask(undefined);
	});

	return (
		<FieldsetToggle legend='Alpha Mask' open={ alphaMask.length > 0 } className='alpha-mask-grid'>
			<span />
			<Button className='slim hideDisabled' onClick={ removeAll } disabled={ alphaMask.length === 0 } >Remove All</Button>
			<hr />
			{ alphaMask.map((p) => (
				<React.Fragment key={ p }>
					<span>{ GetReadablePriorityName(p) }</span>
					<Button className='slim' onClick={ () => removeAlphaMask(p) }>Remove</Button>
				</React.Fragment>
			)) }
			<hr />
			{ LAYER_PRIORITIES
				.filter((p) => !alphaMask.includes(p))
				.map((p) => (
					<React.Fragment key={ p }>
						<span>{ GetReadablePriorityName(p) }</span>
						<Button className='slim' onClick={ () => addAlphaMask(p) }>Add</Button>
					</React.Fragment>
				)) }
		</FieldsetToggle>
	);
}

function GetReadablePriorityName(priority: LayerPriority): string {
	return priority
		.toLowerCase()
		.replace(/_/g, ' ')
		.replace(/(^\w|\s\w)/g, (m) => m.toUpperCase());
}

