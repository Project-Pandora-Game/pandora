import { capitalize, cloneDeep, remove, uniq } from 'lodash-es';
import { Assert, LAYER_PRIORITIES, LayerMirror, LayerMirrorSchema, LayerPriority } from 'pandora-common';
import React, { ReactElement, useId, useMemo, useState } from 'react';
import { useAssetManager } from '../../../assets/assetManager.tsx';
import { GraphicsManagerInstance } from '../../../assets/graphicsManager.ts';
import { useEvent } from '../../../common/useEvent.ts';
import { Checkbox } from '../../../common/userInteraction/checkbox.tsx';
import { Select } from '../../../common/userInteraction/select/select.tsx';
import { useUpdatedUserInput } from '../../../common/useSyncUserInput.ts';
import { Button } from '../../../components/common/button/button.tsx';
import { ColorInput } from '../../../components/common/colorInput/colorInput.tsx';
import { Column, Row } from '../../../components/common/container/container.tsx';
import { ContextHelpButton } from '../../../components/help/contextHelpButton.tsx';
import { useObservable } from '../../../observable.ts';
import { useLayerImageSettingsForScalingStop, useLayerName } from '../../assets/editorAssetCalculationHelpers.ts';
import { EditorAssetGraphics } from '../../assets/editorAssetGraphics.ts';
import { type EditorAssetGraphicsLayer } from '../../assets/editorAssetGraphicsLayer.ts';
import { EditorAssetGraphicsManager } from '../../assets/editorAssetGraphicsManager.ts';
import { useEditorLayerTint } from '../../editor.tsx';
import { useEditor } from '../../editorContextProvider.tsx';
import { ParseLayerImageOverrides, SerializeLayerImageOverrides } from '../../parsing.ts';
import { LayerHeightAndWidthSetting, LayerOffsetSetting } from './layerCommon.tsx';

export function LayerMeshUI({ asset, layer }: {
	asset: EditorAssetGraphics;
	layer: EditorAssetGraphicsLayer<'mesh' | 'alphaImageMesh'>;
}): ReactElement {
	return (
		<>
			{
				(layer.type === 'mesh') ? (
					<>
						<hr />
						<ColorizationSetting layer={ layer } />
						<ColorPicker layer={ layer } asset={ asset } />
					</>
				) : null
			}
			<hr />
			<LayerHeightAndWidthSetting layer={ layer } asset={ asset } />
			<LayerOffsetSetting layer={ layer } asset={ asset } />
			<hr />
			<LayerPrioritySelect layer={ layer } asset={ asset } />
			<LayerTemplateSelect layer={ layer } />
			<LayerPointsFilterEdit layer={ layer } />
			<LayerMirrorSelect layer={ layer } asset={ asset } />
			<hr />
			<LayerImageSelect layer={ layer } asset={ asset } />
			<LayerImageOverridesTextarea layer={ layer } />
			<hr />
			<LayerScalingConfig layer={ layer } asset={ asset } />
		</>
	);
}

function LayerImageSelect({ layer, asset, stop }: { layer: EditorAssetGraphicsLayer<'mesh' | 'alphaImageMesh'>; asset: EditorAssetGraphics; stop?: number; }): ReactElement | null {
	const imageList = useObservable(asset.loadedTextures);
	const stopSettings = useLayerImageSettingsForScalingStop(layer, stop);
	const layerImage = stopSettings.image;

	const elements: ReactElement[] = [<option value='' key=''>[ None ]</option>];
	for (const image of imageList) {
		elements.push(
			<option value={ image } key={ image }>{ image }</option>,
		);
	}

	return (
		<Row alignY='center'>
			<label htmlFor='layer-image-select'>
				Layer image asset:
				<ContextHelpButton>
					<p>
						Select the image you want to be used from the ones you uploaded in the Asset-tab.
					</p>
					<p>
						{ (layer.type === 'alphaImageMesh') ?
							'The image will be used as an alpha mask to hide parts of the images below from the same priority layer.' :
							'The layer will show the assigned image based on the set overrides/stop points (if applicable).' }
						<br />
						{ (layer.type === 'alphaImageMesh') ?
							'Most assets do not need alpha masks. Look at existing skirt/shoe assets for examples of mask usage.' :
							'' }
					</p>
				</ContextHelpButton>
			</label>
			<Select
				id='layer-image-select'
				className='flex'
				value={ layerImage }
				onChange={ (event) => {
					layer.modifyDefinition((d) => {
						if (!stop) {
							d.image.image = event.target.value;
							return;
						}
						const res = d.scaling?.stops.find((s) => s[0] === stop)?.[1];
						if (!res) {
							throw new Error('Failed to get stop');
						}
						res.image = event.target.value;
					});
				} }
			>
				{ elements }
			</Select>
		</Row>
	);
}

function ColorizationSetting({ layer }: { layer: EditorAssetGraphicsLayer<'mesh'>; }): ReactElement | null {
	const value = useObservable(layer.definition).colorizationKey ?? '';
	const onChange = useEvent((newValue: string) => {
		layer.modifyDefinition((d) => {
			d.colorizationKey = newValue || undefined;
		});
	});

	const assetManager = useAssetManager();
	const asset = assetManager.getAssetById(layer.asset.id);
	const id = useId();

	if (asset == null || !(asset.isType('personal') || asset.isType('bodypart')))
		return null;

	const colorization = asset.definition.colorization;

	const elements: ReactElement[] = [];
	for (const [colorId, color] of Object.entries(colorization ?? {})) {
		elements.push(
			<option value={ colorId } key={ colorId }>{ color.name || `${colorId} (hidden)` }{ color.group ? ` (group: '${color.group}')` : '' }</option>,
		);
	}
	if (value && colorization?.[value] == null) {
		elements.push(
			<option value={ value } key={ value }>[ ERROR: Unknown key '{ value }' ]</option>,
		);
	}

	return (
		<Row alignY='center'>
			<label htmlFor={ id }>
				Color:
			</label>
			<ContextHelpButton>
				<p>
					This selects the key of the color this layer should use for tinting the asset image.<br />
				</p>
				<p>
					In the asset.ts file of the asset, that you already have or will create later,<br />
					there is a setting 'colorization' about the default colors the asset uses.
				</p>
				<p>
					To prevent this layer from being colorable, set this value to "None".
				</p>
				<p>
					You cannot define new colors and their names in the editor but only in the asset code (*.asset.ts file).
				</p>
				<p>
					If the colorization definition also has an inheritance group, it will be shown here.<br />
					If the group is active, then this layer will inherit the color of any item with the same group.
				</p>
				<p>
					The inheritance group will always be active if the colorization doesn't have a name.<br />
					Otherwise, it can be activated by the 'overrideColorKey' asset property.
				</p>
				<p>
					To prevent an item from being the base of color group inheritance,<br />
					you can set the 'excludeFromColorInheritance' property to list the color key.
				</p>
			</ContextHelpButton>
			<Select
				id={ id }
				className='flex-1'
				value={ value }
				onChange={ (event) => {
					const newValue = event.target.value;
					if (newValue && colorization?.[newValue] == null) {
						return;
					}
					onChange(newValue);
				} }
				noScrollChange
			>
				<option value='' key='!empty'>- None -</option>
				{ elements }
			</Select>
		</Row>
	);
}

function ColorPicker({ layer }: { layer: EditorAssetGraphicsLayer<'mesh'>; asset: EditorAssetGraphics; }): ReactElement | null {
	const editor = useEditor();

	const visibleName = useLayerName(layer);
	const tint = useEditorLayerTint(layer);

	return (
		<Row alignY='center'>
			<label>
				Layer tint:
			</label>
			<ContextHelpButton>
				<p>
					You can manually select the layer tint by pressing on the rectangle.<br />
					This color is only valid for testing in the editor and is not saved!<br />
					You cannot define new colors in the editor but only in the asset<br />
					code (*.asset.ts file).<br />
					Per default, the rectangle shows the color of the selected color index<br />
					in the 'Colorization index' drop-down menu.<br />
					The button on the right resets the color to the color of the selected index.
				</p>
			</ContextHelpButton>
			<ColorInput
				hideTextInput
				title={ `Layer '${visibleName}' tint` }
				initialValue={ `#${tint.toString(16).padStart(6, '0')}` }
				onChange={ (newValue) => {
					editor.setLayerTint(layer, Number.parseInt(newValue.replace(/^#/, ''), 16));
				} }
			/>
			<Button className='slim' onClick={ () => editor.setLayerTint(layer, undefined) } >↺</Button>
		</Row>
	);
}

function LayerPrioritySelect({ layer }: { layer: EditorAssetGraphicsLayer<'mesh' | 'alphaImageMesh'>; asset: EditorAssetGraphics; }): ReactElement | null {
	const {
		priority: layerPriority,
	} = useObservable(layer.definition);

	const elements: ReactElement[] = [];

	for (const priority of LAYER_PRIORITIES) {
		elements.push(
			<option value={ priority } key={ priority }>{ GetReadablePriorityName(priority) }</option>,
		);
	}

	return (
		<Row alignY='center'>
			<label htmlFor='layer-priority-select'>
				Layer priority type:
				<ContextHelpButton>
					<p>
						This selects the priority of this layer so that it is ordered correctly<br />
						between the numerous body layers, which are filled with the images from<br />
						all equipped items on the character.
					</p>
					<p>
						You likely need to experiment a bit here and watch how it changes the<br />
						editor character in the Preview-tab. Also, turn the character view around in<br />
						the Pose-tab to see how it looks from behind.
					</p>
					<p>
						Sometimes, you may need to use the same image in two layers at different priorities,<br />
						e.g. once above the breasts and the same image also once below the breasts.
					</p>
				</ContextHelpButton>
			</label>
			<Select
				id='layer-priority-select'
				className='flex-1'
				value={ layerPriority }
				onChange={ (event) => {
					layer.modifyDefinition((d) => {
						d.priority = event.target.value as LayerPriority;
					});
				} }
			>
				{ elements }
			</Select>
		</Row>
	);
}

function LayerTemplateSelect({ layer }: { layer: EditorAssetGraphicsLayer<'mesh' | 'alphaImageMesh'>; }): ReactElement | null {
	const { points } = useObservable(layer.definition);
	const graphicsManger = useObservable(GraphicsManagerInstance);

	if (!graphicsManger)
		return null;

	const elements: ReactElement[] = [];
	for (const t of graphicsManger.pointTemplates.keys()) {
		const id = `t/${t}`;
		elements.push(
			<option value={ id } key={ id }>{ capitalize(t) }</option>,
		);
	}
	return (
		<Row alignY='center'>
			<label htmlFor='layer-template-select'>
				Point template for layer:
				<ContextHelpButton>
					<p>
						This is a very important selector.<br />
						It lets you define the set of points this layer should use for<br />
						transformations based on pose changes.
					</p>
					<p>
						The templates should be self-explanatory.<br />
						If you make any asset that should change alongside body changes,<br />
						you use 'body' - unless it is an asset where a more specialized<br />
						template exists, e.g. 'shirt' for tops, or 'skirt_short/skirt_long'.
					</p>
					<p>
						A special template is 'static'. This one covers the whole canvas<br />
						and does not use any transformations. That way, it can be used for images<br />
						that should always be on the same spot in the same size.
					</p>
					<p>
						If you cannot find a suitable template for your purpose or the<br />
						chosen template cuts off parts of your image: Please get help on<br />
						Discord, as you either need custom points for this layer or we<br />
						need to make a new template for your asset.
					</p>
				</ContextHelpButton>
			</label>
			<Select
				id='layer-template-select'
				className='flex-1'
				value={ `t/${points}` }
				onChange={ (event) => {
					Assert(event.target.value.startsWith('t/'));
					const source = event.target.value.substring(2);
					const template = graphicsManger?.getTemplate(source);
					Assert(template != null, 'Unknown point template');
					layer.modifyDefinition((d) => {
						d.points = source;
					});
				} }
			>
				<option value='t/' key='t/'>[ No points ]</option>
				{ elements }
			</Select>
		</Row>
	);
}

function LayerPointsFilterEdit({ layer }: { layer: EditorAssetGraphicsLayer<'mesh' | 'alphaImageMesh'>; }): ReactElement | null {
	const { points, pointType } = useObservable(layer.definition);
	const template = useObservable(EditorAssetGraphicsManager.editedPointTemplates).get(points) ??
		EditorAssetGraphicsManager.originalPointTempalates[points];

	// TODO: Consider rephrasing this.
	return (
		<fieldset>
			<legend>
				Point type filter
				<ContextHelpButton>
					<p>
						The 'point type filter' field lets you list the names of point types the image of<br />
						this layer will touch. For instance, 'body' is the name of all points on the body,<br />
						whereas 'bodyarms' are the few points that are both part of the body as well as<br />
						the arms. The other points along the arms are of type 'arms'.
					</p>
					<p>
						The rule of thumb is that if you create an asset that uses all points,<br />
						you simply leave the field empty, as this will then not filter points at all<br />
						and increases rendering performance.
					</p>
					<p>
						If your asset should only be visible partially, filtering points makes sense:<br />
						For instance, if you want to mirror an asset and only show it on one half of the body.<br />
						You can look at the "body/eyes3" asset to see how you filter for one half of the<br />
						static point space.
					</p>
					<p>
						Another case where you need the filters is if you want parts of your image<br />
						asset to be visible on different priority layers, e.g. the sleeves of a jacket.<br />
						In this case, you need two layers with the same image asset and split them over<br />
						the two desired layers using the point filters.<br />
						You can take a look at the "top/t-shirt" asset to see an example of this.
					</p>
					<p>
						More point types may be introduced later on.
					</p>
					<p>
						The character view in the Preview-tab will help you to see if you filtered<br />
						for the right point types. If your asset does not show correctly in typical<br />
						poses, wrong point types (together with missing splits) here can be a cause of this.
					</p>
				</ContextHelpButton>
			</legend>
			<ul style={ { columns: '5em 3' } }>
				{
					pointType
						?.filter((p) => template == null || !Object.hasOwn(template.pointTypes, p))
						.map((p) => (
							<li key={ p }>
								<label>
									<Checkbox
										checked
										onChange={ () => {
											layer.modifyDefinition((d) => {
												d.pointType = pointType.filter((pf) => pf !== p);
											});
										} }
									/>
									<s>{ p }</s>
								</label>
							</li>
						))
				}
				{
					Object.keys(template?.pointTypes ?? {})
						.map((p) => (
							<li key={ p }>
								<label>
									<Checkbox
										checked={ pointType == null || pointType.includes(p) }
										onChange={ (checked) => {
											const newValue = uniq(pointType?.slice() ?? Object.keys(template?.pointTypes ?? {}));
											if (checked) {
												if (!newValue.includes(p)) {
													newValue.push(p);
												}
											} else {
												remove(newValue, (pf) => pf === p);
											}
											const keys = Object.keys(template?.pointTypes ?? {});
											newValue.sort((a, b) => keys.indexOf(a) - keys.indexOf(b));

											const allMatch = keys.every((pf) => newValue.includes(pf));
											layer.modifyDefinition((d) => {
												if (allMatch) {
													delete d.pointType;
												} else {
													d.pointType = newValue;
												}
											});
										} }
									/>
									{ p }
								</label>
							</li>
						))
				}
			</ul>
		</fieldset>
	);
}

const LAYER_MIRROR_OPTIONS: Record<LayerMirror, string> = {
	[LayerMirror.NONE]: 'None',
	[LayerMirror.SELECT]: 'Duplicate and mirror',
};
function LayerMirrorSelect({ layer }: { layer: EditorAssetGraphicsLayer<'mesh' | 'alphaImageMesh'>; asset: EditorAssetGraphics; }): ReactElement | null {
	const {
		mirror: layerMirror,
	} = useObservable(layer.definition);

	const elements: ReactElement[] = [];

	for (const [mirror, text] of Object.entries(LAYER_MIRROR_OPTIONS)) {
		elements.push(
			<option value={ mirror } key={ mirror }>{ text }</option>,
		);
	}

	return (
		<Row alignY='center'>
			<label htmlFor='layer-mirror-select'>
				Layer mirroring:
			</label>
			<Select
				id='layer-mirror-select'
				className='flex-1'
				value={ String(layerMirror) }
				onChange={ (event) => {
					layer.modifyDefinition((d) => {
						d.mirror = LayerMirrorSchema.parse(Number.parseInt(event.target.value));
					});
				} }
			>
				{ elements }
			</Select>
		</Row>
	);
}

function LayerImageOverridesTextarea({ layer, stop }: { layer: EditorAssetGraphicsLayer<'mesh' | 'alphaImageMesh'>; stop?: number; }): ReactElement {
	const assetManager = useAssetManager();
	const stopSettings = useLayerImageSettingsForScalingStop(layer, stop);
	const [value, setValue] = useUpdatedUserInput(
		SerializeLayerImageOverrides(stopSettings.overrides),
		[layer, stop]);
	const [error, setError] = useState<string | null>(null);

	const onChange = useEvent((e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setValue(e.target.value);
		try {
			const result = ParseLayerImageOverrides(e.target.value, assetManager.getAllBones().map((b) => b.name));
			setError(null);
			layer.modifyDefinition((d) => {
				if (!stop) {
					d.image.overrides = result.slice();
					return;
				}
				const res = d.scaling?.stops.find((s) => s[0] === stop)?.[1];
				if (!res) {
					throw new Error('Failed to get stop');
				}
				res.overrides = result.slice();
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		}

	});

	return (
		<Row alignY='center'>
			<div>
				Image overrides:
				<ContextHelpButton>
					<p>
						This field lets you define conditions for when the chosen image should be replaced.<br />
						An image can be replaced with another image uploaded in the Asset-tab or the <br />
						current image can be hidden by not providing a trailing filename for the override.<br />
						Examples further down. Conditions can be chained with AND ( &amp; ) and OR ( | ) characters.
					</p>
					<p>
						A condition follows the format [name][&lt;|=|&gt;][value] [image filename(optional)].<br />
						The first value of a condition can either be the name of a bone or of a module defined in<br />
						'*.asset.ts' file of the current asset later on.<br />
						If it is the name of a module you need to prefix it with 'm_' such as m_[modulename].
					</p>
					<p>
						The value of a bone can be between -180 and 180 (see Poses-tab).<br />
						The value of a module is typically the id of the related variant.
					</p>
					<p>
						You can find the names of all bones in the file /pandora-assets/src/bones.ts<br />
						Note that arm_r means only the right arm but there is also arm_l for the left one.
					</p>
					<p>
						Hand rotation and finger positions can also be specified: <br />
						`hand_&lt;'rotation' | 'fingers'&gt;_&lt;'left' | 'right'&gt;` <br />
						For rotation, the options are: up, down, forward, backward.<br />
						For fingers, the options are: fist and spread.
					</p>
					Every line in the input field is one condition. Some examples:
					<ul>
						<li>
							m_ropeStateModule=harness&amp;breasts&gt;100 rope_harness_largest.png<br />
							This means that if the module with the name 'ropeStateModule' has harness selected<br />
							and the breasts slider is larger than 100, the default layer image is replaced.
						</li>
						<li>
							leg_l&lt;0|backView&gt;0 <br />
							This means that if the left leg slider is in the negative OR the character is in<br />
							the back view, we hide the current image (we replace it with no image).<br />
							'backView' is a fake bone that has two states: backView&gt;0 and backView=0<br />
							It is useful for some assets like shoes to stop the front or back view image<br />
							from leaking from behind the body when undesired.
						</li>
						<li>
							hand_rotation_left=up <br />
							This means that if the left hand is rotated up, the default layer image is replaced.
						</li>
						<li>
							hand_fingers_right=spread <br />
							This means that if the right hand fingers are in a spread position, the default layer image is replaced.
						</li>
					</ul>
				</ContextHelpButton>
			</div>
			<textarea
				spellCheck='false'
				rows={ 6 }
				value={ value }
				onChange={ onChange }
			/>
			{ error != null && <div className='error'>{ error }</div> }
		</Row>
	);
}

function LayerScalingConfig({ layer, asset }: { layer: EditorAssetGraphicsLayer<'mesh' | 'alphaImageMesh'>; asset: EditorAssetGraphics; }): ReactElement {
	const assetManager = useAssetManager();
	const {
		scaling: layerScaling,
	} = useObservable(layer.definition);

	const elements: ReactElement[] = [
		<option value='' key=''>[ Nothing ]</option>,
	];

	for (const bone of assetManager.getAllBones()) {
		if (bone.x || bone.y)
			continue;
		elements.push(
			<option value={ bone.name } key={ bone.name }>{ bone.name }</option>,
		);
	}

	return (
		<>
			<Column alignX='stretch'>
				<label htmlFor='layer-scaling-bone-select'>
					Select an image based on the value of bone:
					<ContextHelpButton>
						<p>
							This drop-down menu lets you override images based on the value/state of the<br />
							selected bone/slider (see Pose-tab). Here, you can, for instance, select the<br />
							breasts bone and then add the predefined stop-points (aka "breast-sizes" in<br />
							this case) for which you want to overwrite the standard layer image with<br />
							another one. This is used, for instance, to show the asset in the proper size<br />
							that looks realistic for how the selected bone/slider state transformed the body.
						</p>
						<p>
							In other words and for the breast example:<br />
							You could create up to 5 images showing the item (e.g. a t-shirt) with different<br />
							breast sizes and then set the images here for the corresponding stop points.
						</p>
						<p>
							Note that you do not need an image for every stop point; missing ones will be<br />
							automatically scaled by the system using the next nearest available stop point<br />
							image. But adding premade images for all stop points may lead to higher<br />
							quality results.
						</p>
						<p>
							As a rule of thumb, you likely only need two images for the stop points<br />
							'flat' and 'small' besides the default layer image (which is implicitly<br />
							a stop point that is called 'medium' in the body templates).
						</p>
					</ContextHelpButton>
				</label>
				<Select
					id='layer-scaling-bone-select'
					className='flex'
					value={ layerScaling?.scaleBone ?? '' }
					onChange={ (event) => {
						const scaleAs = event.target.value;
						layer.modifyDefinition((d) => {
							if (scaleAs) {
								d.scaling = {
									scaleBone: scaleAs,
									stops: [],
								};
							} else {
								d.scaling = undefined;
							}
						});
					} }
				>
					{ elements }
				</Select>
			</Column>
			{
				layerScaling && <LayerScalingList layer={ layer } asset={ asset } />
			}
		</>
	);
}

function LayerScalingList({ layer, asset }: { layer: EditorAssetGraphicsLayer<'mesh' | 'alphaImageMesh'>; asset: EditorAssetGraphics; }): ReactElement | null {
	// TODO: Base on actual stops; right now temporary for breasts
	const possibleStops: [string, number][] = useMemo(() => [
		['flat', -180],
		['small', - 70],
		// ['medium', 0],
		['large', 100],
		['huge', 180],
	], []);

	const [toAdd, setToAdd] = useState('');

	const scalingStops = useObservable(layer.definition).scaling?.stops;

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

		const value = addStop[1];
		if (value === 0 || !Number.isInteger(value) || value < -180 || value > 180) {
			throw new Error('Invalid value supplied');
		}

		layer.modifyDefinition((d) => {
			Assert(d.scaling, 'Cannot add scaling stop if not scaling');

			if (d.scaling.stops.some((stop) => stop[0] === value))
				return;

			d.scaling.stops.push([value, cloneDeep(d.image)]);
			d.scaling.stops.sort((a, b) => a[0] - b[0]);
		});

		setToAdd('');
	};

	return (
		<>
			<Row alignY='center'>
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
			</Row>
			{ scalingStops?.map((stop) => (
				<React.Fragment key={ `${stop[0]}-header` }>
					<Row alignY='center'>
						<h3 className='flex-1'>{ possibleStops.find((p) => p[1] === stop[0])?.[0] ?? `${stop[0]}` }</h3>
						<Button className='slim' onClick={ () => {
							layer.modifyDefinition((d) => {
								Assert(d.scaling, 'Cannot remove scaling stop if not scaling');

								d.scaling.stops = d.scaling.stops.filter((s) => s[0] !== stop[0]);
							});
						} }>
							Remove
						</Button>
					</Row>
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
