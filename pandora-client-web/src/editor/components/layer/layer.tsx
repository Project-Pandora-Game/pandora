import { capitalize } from 'lodash';
import { LayerPriority, LAYER_PRIORITIES } from 'pandora-common';
import React, { ReactElement, useMemo, useState, useSyncExternalStore } from 'react';
import { AssetGraphicsLayer } from '../../../assets/assetGraphics';
import { GetAssetManager } from '../../../assets/assetManager';
import { GraphicsManagerInstance } from '../../../assets/graphicsManager';
import { useEvent } from '../../../common/useEvent';
import { useSyncUserInput } from '../../../common/useSyncUserInput';
import { Button } from '../../../components/common/Button/Button';
import { Select } from '../../../components/common/Select/Select';
import { Scrollbar } from '../../../components/common/scrollbar/scrollbar';
import { FAKE_BONES } from '../../../graphics/graphicsCharacter';
import { StripAssetIdPrefix } from '../../../graphics/utility';
import { useObservable } from '../../../observable';
import { useEditor } from '../../editorContextProvider';
import { EditorAssetGraphics } from '../../graphics/character/appearanceEditor';
import { ParseLayerImageOverrides, SerializeLayerImageOverrides } from '../../parsing';

export function LayerUI(): ReactElement {
	const editor = useEditor();
	const selectedLayer = useObservable(editor.targetLayer);
	const asset = selectedLayer?.asset;

	if (!asset || !(asset instanceof EditorAssetGraphics)) {
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

	return (
		<Scrollbar color='lighter' className='editor-setupui slim'>
			<LayerName layer={ selectedLayer } />
			<hr />
			<ColorizationSetting layer={ selectedLayer } asset={ asset } />
			<ColorPicker layer={ selectedLayer } asset={ asset } />
			<hr />
			<LayerPrioritySelect layer={ selectedLayer } asset={ asset } />
			<LayerTemplateSelect layer={ selectedLayer } asset={ asset } />
			<LayerPointsFilterEdit layer={ selectedLayer } />
			<hr />
			<LayerImageSelect layer={ selectedLayer } asset={ asset } />
			<LayerImageOverridesTextarea layer={ selectedLayer } />
			<LayerImageSelect layer={ selectedLayer } asset={ asset } asAlpha />
			<LayerImageOverridesTextarea layer={ selectedLayer } asAlpha />
			<hr />
			<LayerScalingConfig layer={ selectedLayer } asset={ asset } />
		</Scrollbar>
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
						l.onChange(false);
					} }
				/>
			</div>
		</>
	);
}

function LayerImageSelect({ layer, asset, stop, asAlpha = false }: { layer: AssetGraphicsLayer; asset: EditorAssetGraphics; stop?: number; asAlpha?: boolean; }): ReactElement | null {
	const imageList = useSyncExternalStore(asset.editor.getSubscriber('modifiedAssetsChange'), () => asset.loadedTextures);
	const layerImage = useSyncExternalStore(layer.getSubscriber('change'), () => {
		const stopSettings = layer.getImageSettingsForScalingStop(stop);
		return asAlpha ? (stopSettings.alphaImage ?? '') : stopSettings.image;
	});

	const elements: ReactElement[] = [<option value='' key=''>[ None ]</option>];
	for (const image of imageList) {
		elements.push(
			<option value={ image } key={ image }>{ image }</option>,
		);
	}

	return (
		<div>
			<label htmlFor='layer-image-select'>{ asAlpha ? 'Alpha' : 'Layer' } image asset:</label>
			<Select
				id='layer-image-select'
				className='flex'
				value={ layerImage }
				onChange={ (event) => {
					if (asAlpha) {
						layer.setAlphaImage(event.target.value, stop);
					} else {
						layer.setImage(event.target.value, stop);
					}
				} }
			>
				{ elements }
			</Select>
		</div>
	);
}

function ColorizationSetting({ layer, asset }: { layer: AssetGraphicsLayer; asset: EditorAssetGraphics; }): ReactElement | null {
	const [value, setValue] = useSyncUserInput(
		layer.getSubscriber('change'),
		() => layer.definition.colorizationIndex ?? -1,
	);

	const colorLayerName = useMemo(() => {
		if (value < 0)
			return '[ Not colorable ]';
		const colorization = asset.asset.definition.colorization;
		if (!colorization || value >= colorization.length)
			return '[ Invalid index ]';
		const name = colorization[value].name;
		if (name == null)
			return '[ Not colorable by user ]';
		return name;
	}, [value, asset]);

	const onChange = useEvent((e: React.ChangeEvent<HTMLInputElement>) => {
		const newValue = Math.max(-1, Math.round(e.target.valueAsNumber));
		setValue(newValue);
		layer.setColorizationIndex(newValue < 0 ? null : newValue);
	});

	return (
		<>
			<div>
				<label
					htmlFor='layer-colorization'
					title="Index in asset's 'colorization' setting that this layer follows for colorability by user; -1 if not colorable."
				>
					Colorization index (?):
				</label>
				<input
					id='layer-colorization'
					type='number'
					value={ value }
					min={ -1 }
					step={ 1 }
					onChange={ onChange }
					className='flex-1'
				/>
			</div>
			<div>
				<label
					htmlFor='layer-colorization-name'
					title="Resolved name of color setting, based on value of 'Colorization index'"
				>
					Colorization name (?):
				</label>
				<input
					id='layer-colorization-name'
					type='text'
					value={ colorLayerName }
					readOnly
					className='flex-1'
				/>
			</div>
		</>
	);
}

function ColorPicker({ layer, asset }: { layer: AssetGraphicsLayer; asset: EditorAssetGraphics; }): ReactElement | null {
	const editor = asset.editor;

	const tint = useSyncExternalStore<number>((changed) => {
		const cleanup: (() => void)[] = [];
		cleanup.push(editor.on('layerOverrideChange', (changedLayer) => {
			if (changedLayer === layer) {
				changed();
			}
		}));
		cleanup.push(layer.on('change', () => {
			changed();
		}));
		return () => cleanup.forEach((c) => c());
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
			<Button className='slim' onClick={ () => editor.setLayerTint(layer, undefined) } >↺</Button>
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
			<Select
				id='layer-priority-select'
				className='flex-1'
				value={ layerPriority }
				onChange={ (event) => {
					asset.setLayerPriority(layer, event.target.value as LayerPriority);
				} }
			>
				{ elements }
			</Select>
		</div>
	);
}

function LayerTemplateSelect({ layer, asset }: { layer: AssetGraphicsLayer; asset: EditorAssetGraphics; }): ReactElement | null {
	const points = useSyncExternalStore(layer.getSubscriber('change'), () => layer.definition.points);
	const graphicsManger = useObservable(GraphicsManagerInstance);

	if (!graphicsManger)
		return null;

	const elements: ReactElement[] = [];
	for (const t of graphicsManger.pointTemplateList) {
		const id = `t/${t}`;
		elements.push(
			<option value={ id } key={ id }>{ capitalize(t) }</option>,
		);
	}
	return (
		<div>
			<label htmlFor='layer-template-select'>
				Point template for layer:
			</label>
			<Select
				id='layer-template-select'
				className='flex-1'
				value={ typeof points === 'string' ? `t/${points}` : (Array.isArray(points) && points.length === 0) ? 't/' : '' }
				onChange={ (event) => {
					let source: number | string | null = null;
					if (event.target.value.startsWith('t/')) {
						source = event.target.value.substring(2);
					} else if (event.target.value) {
						source = Number.parseInt(event.target.value);
					}
					asset.layerMirrorFrom(layer, source);
				} }
			>
				<option value='t/' key='t/'>[ No points ]</option>
				{ elements }
				<option value='' key=''>[ Custom points ]</option>
			</Select>
		</div>
	);
}

function LayerPointsFilterEdit({ layer }: { layer: AssetGraphicsLayer }): ReactElement | null {
	const [value, setValue] = useSyncUserInput(layer.getSubscriber('change'), () => layer.definition.pointType?.join(',') ?? '', [layer]);

	const onChange = useEvent((e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setValue(e.target.value);
		layer.setPointType(
			e.target.value
				.split(',')
				.map((t) => t.trim())
				.filter((t) => !!t),
		);
	});

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

function LayerImageOverridesTextarea({ layer, stop, asAlpha = false }: { layer: AssetGraphicsLayer; stop?: number; asAlpha?: boolean; }): ReactElement {
	const [value, setValue] = useSyncUserInput(layer.getSubscriber('change'), () => {
		const stopSettings = layer.getImageSettingsForScalingStop(stop);
		return SerializeLayerImageOverrides(asAlpha ? (stopSettings.alphaOverrides ?? []) : stopSettings.overrides);
	}, [layer, stop, asAlpha]);
	const [error, setError] = useState<string | null>(null);

	const onChange = useEvent((e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setValue(e.target.value);
		try {
			const result = ParseLayerImageOverrides(e.target.value, GetAssetManager().getAllBones().map((b) => b.name).concat(FAKE_BONES));
			setError(null);
			if (asAlpha) {
				layer.setAlphaOverrides(result, stop);
			} else {
				layer.setImageOverrides(result, stop);
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		}

	});

	return (
		<div>
			<div>{ asAlpha ? 'Alpha' : 'Image' } overrides:</div>
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
				<Select
					id='layer-scaling-bone-select'
					className='flex'
					value={ layerScaling?.scaleBone ?? '' }
					onChange={ (event) => {
						asset.setScaleAs(layer, event.target.value);
					} }
				>
					{ elements }
				</Select>
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
				<Select
					id='layer-scaling-add-point-select'
					className='flex'
					value={ toAdd }
					onChange={ (event) => {
						setToAdd(event.target.value);
					} }
				>
					{ optionsToAdd }
				</Select>
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

function GetReadablePriorityName(priority: LayerPriority): string {
	return priority
		.toLowerCase()
		.replace(/_/g, ' ')
		.replace(/(^\w|\s\w)/g, (m) => m.toUpperCase());
}
