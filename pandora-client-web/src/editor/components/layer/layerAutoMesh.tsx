import { castDraft, produce, type Draft, type Immutable } from 'immer';
import { capitalize, snakeCase } from 'lodash-es';
import {
	Assert,
	AssertNever,
	AutoMeshLayerGenerateVariableData,
	BONE_MAX,
	BONE_MIN,
	GenerateMultipleListsFullJoin,
	GRAPHICS_AUTOMESH_LAYER_DEFAULT_VARIANT,
	KnownObject,
	LegsPoseSchema,
	SortPathStrings,
	type Asset,
	type AutoMeshLayerGenerateVariableValue,
	type GraphicsBuildContext,
	type GraphicsBuildContextAssetData,
	type GraphicsSourceAutoMeshGraphicalLayer,
	type GraphicsSourceAutoMeshLayerVariable,
} from 'pandora-common';
import { useCallback, useEffect, useId, useMemo, useState, type ReactElement } from 'react';
import { useAssetManager } from '../../../assets/assetManager.tsx';
import crossIcon from '../../../assets/icons/cross.svg';
import { Checkbox } from '../../../common/userInteraction/checkbox.tsx';
import { NumberInput } from '../../../common/userInteraction/input/numberInput.tsx';
import { TextInput } from '../../../common/userInteraction/input/textInput.tsx';
import { Select } from '../../../common/userInteraction/select/select.tsx';
import { Button, IconButton } from '../../../components/common/button/button.tsx';
import { Column, Row } from '../../../components/common/container/container.tsx';
import { ExternalLink } from '../../../components/common/link/externalLink.tsx';
import { Tab, TabContainer } from '../../../components/common/tabs/tabs.tsx';
import { ModalDialog } from '../../../components/dialog/dialog.tsx';
import { ContextHelpButton } from '../../../components/help/contextHelpButton.tsx';
import { InventoryAttributePreview } from '../../../components/wardrobe/wardrobeComponents.tsx';
import { useObservable } from '../../../observable.ts';
import { useAssetManagerEditor } from '../../assets/assetManager.ts';
import { EditorBuildAssetGraphicsWornContext } from '../../assets/editorAssetGraphicsBuilding.ts';
import { EditorAssetGraphicsManager, useEditorPointTemplates } from '../../assets/editorAssetGraphicsManager.ts';
import type { EditorAssetGraphicsRoomDeviceLayer } from '../../assets/editorAssetGraphicsRoomDeviceLayer.ts';
import type { EditorAssetGraphicsWornLayer } from '../../assets/editorAssetGraphicsWornLayer.ts';
import { LayerHeightAndWidthSetting, LayerOffsetSetting } from './layerCommon.tsx';

export function LayerAutoMeshUI({ layer }: {
	layer: EditorAssetGraphicsWornLayer<'autoMesh'>;
}): ReactElement {
	return (
		<>
			<hr />
			<LayerHeightAndWidthSetting layer={ layer } />
			<LayerOffsetSetting layer={ layer } />
			<hr />
			<LayerNormalMapSettings layer={ layer } />
			<hr />
			<TabContainer allowWrap>
				<Tab name='Template'>
					<hr />
					<LayerTemplateSelect layer={ layer } />
					<LayerAutomeshTemplateSelect layer={ layer } />
					<LayerAutomeshPartsDiable layer={ layer } />
				</Tab>
				<Tab name='Graphical layers'>
					<hr />
					<LayerAutomeshGraphicalLayers layer={ layer } />
				</Tab>
				<Tab name='Variables'>
					<hr />
					<LayerAutomeshVariables layer={ layer } />
				</Tab>
				<Tab name='Images'>
					<hr />
					<LayerAutomeshImages layer={ layer } />
				</Tab>
			</TabContainer>
		</>
	);
}

export function LayerNormalMapSettings({ layer }: {
	layer: EditorAssetGraphicsWornLayer<'autoMesh'> | EditorAssetGraphicsRoomDeviceLayer<'sprite' | 'autoSprite'>;
}): ReactElement {
	const { normalMap } = useObservable(layer.definition);

	return (
		<>
			<label>
				<Checkbox
					checked={ normalMap != null }
					onChange={ (newValue) => {
						layer.modifyDefinition((d) => {
							d.normalMap = newValue ? { specularStrength: 0.2, roughness: 0 } : undefined;
						});
					} }
				/>
				Layer has normal map
				<ContextHelpButton>
					<p>
						You only need to tick this, if your asset has <ExternalLink href='https://en.wikipedia.org/wiki/Normal_mapping'>normal maps</ExternalLink>.<br />
						Your asset does not need to have normal maps.
					</p>
					<p>
						A normal map is an image based information about the surface structure of a texture.<br />
						It can improve lighting and shading of an asset. If you modeled your asset in 3D, you are likely<br />
						able to export additional images containing normal maps from it for usage in Pandora.
					</p>
				</ContextHelpButton>
			</label>
			{
				normalMap != null ? (
					<>
						<Row>
							<label>Specular strength</label>
							<NumberInput
								rangeSlider
								className='flex-6 zero-width'
								value={ normalMap.specularStrength }
								onChange={ (newValue) => {
									layer.modifyDefinition((d) => {
										Assert(d.normalMap != null);
										d.normalMap.specularStrength = newValue;
									});
								} }
								min={ 0 }
								max={ 1 }
								step={ 0.01 }
							/>
							<NumberInput
								className='flex-grow-1'
								value={ normalMap.specularStrength }
								onChange={ (newValue) => {
									layer.modifyDefinition((d) => {
										Assert(d.normalMap != null);
										d.normalMap.specularStrength = newValue;
									});
								} }
								min={ 0 }
								max={ 1 }
								step={ 0.01 }
							/>
						</Row>
						<Row>
							<label>Roughness</label>
							<NumberInput
								rangeSlider
								className='flex-6 zero-width'
								value={ normalMap.roughness }
								onChange={ (newValue) => {
									layer.modifyDefinition((d) => {
										Assert(d.normalMap != null);
										d.normalMap.roughness = newValue;
									});
								} }
								min={ 0 }
								max={ 1 }
								step={ 0.01 }
							/>
							<NumberInput
								className='flex-grow-1'
								value={ normalMap.roughness }
								onChange={ (newValue) => {
									layer.modifyDefinition((d) => {
										Assert(d.normalMap != null);
										d.normalMap.roughness = newValue;
									});
								} }
								min={ 0 }
								max={ 1 }
								step={ 0.01 }
							/>
						</Row>
					</>
				) : null
			}
		</>
	);
}

function LayerTemplateSelect({ layer }: { layer: EditorAssetGraphicsWornLayer<'autoMesh'>; }): ReactElement | null {
	const { points } = useObservable(layer.definition);
	const pointTemplates = useEditorPointTemplates();

	const elements: ReactElement[] = [];
	for (const [t, template] of pointTemplates) {
		if (!template.automeshTemplates)
			continue;

		elements.push(
			<option value={ t } key={ t }>{ capitalize(t) }</option>,
		);
	}
	return (
		<Row alignY='center'>
			<label htmlFor='layer-template-select'>
				Template:
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
				value={ points }
				onChange={ (event) => {
					const id = event.target.value;
					const template = pointTemplates?.get(id);
					Assert(id === '' || template != null, 'Unknown point template');
					layer.modifyDefinition((d) => {
						d.points = id;
					});
				} }
			>
				<option value='' key='!empty'>[ No points ]</option>
				{ elements }
			</Select>
		</Row>
	);
}

function LayerAutomeshTemplateSelect({ layer }: { layer: EditorAssetGraphicsWornLayer<'autoMesh'>; }): ReactElement {
	const id = useId();
	const { points, automeshTemplate } = useObservable(layer.definition);
	const pointTemplate = useEditorPointTemplates().get(points);
	const allAutomeshTemplates = pointTemplate?.automeshTemplates;

	const elements: ReactElement[] = [];
	for (const [templateId, template] of Object.entries(allAutomeshTemplates ?? {})) {
		elements.push(
			<option value={ templateId } key={ templateId }>{ template.name }</option>,
		);
	}
	if (automeshTemplate && allAutomeshTemplates?.[automeshTemplate] == null) {
		elements.push(
			<option value={ automeshTemplate } key={ automeshTemplate }>[ ERROR: Unknown template '{ automeshTemplate }' ]</option>,
		);
	}

	return (
		<>
			<Row alignY='center'>
				<label htmlFor={ id }>
					Template variant:
					<ContextHelpButton>
						<p>
							This selector lets you select a variant of how to automatically generate layers.<br />
							The available options change depending on the selected template.
						</p>
					</ContextHelpButton>
				</label>
				<Select
					id={ id }
					className='flex-1'
					value={ automeshTemplate }
					disabled={ allAutomeshTemplates == null }
					onChange={ (event) => {
						const value = event.target.value;
						if (value && allAutomeshTemplates?.[value] == null) {
							return;
						}
						layer.modifyDefinition((d) => {
							d.automeshTemplate = value;
						});
					} }
				>
					<option value='' key='!empty'>- Select a template -</option>
					{ elements }
				</Select>
			</Row>
			<span>For templates with mirrored parts, configure primarily for <strong>LEFT</strong> side.</span>
		</>
	);
}

function LayerAutomeshPartsDiable({ layer }: { layer: EditorAssetGraphicsWornLayer<'autoMesh'>; }): ReactElement {
	const { points, automeshTemplate, disabledTemplateParts } = useObservable(layer.definition);
	const pointTemplate = useEditorPointTemplates().get(points);

	const selectedTemplate = automeshTemplate ? pointTemplate?.automeshTemplates?.[automeshTemplate] : undefined;
	const validPartIds = selectedTemplate ? selectedTemplate.parts.map((p) => p.id) : [];

	return (
		<fieldset>
			<legend>Enabled template parts</legend>
			<Column alignX='start'>
				{
					validPartIds.map((p) => (
						<label key={ p }>
							<Checkbox checked={ !disabledTemplateParts?.includes(p) } onChange={ (newValue) => {
								layer.modifyDefinition((d) => {
									if (newValue) {
										d.disabledTemplateParts = d.disabledTemplateParts?.filter((part) => part !== p);
										if (d.disabledTemplateParts?.length === 0) {
											d.disabledTemplateParts = undefined;
										}
									} else {
										if (!d.disabledTemplateParts?.includes(p)) {
											d.disabledTemplateParts = [...(d.disabledTemplateParts ?? []), p];
										}
									}
								});
							} } />
							{ p }
						</label>
					))
				}
				{
					disabledTemplateParts
						?.filter((p) => !validPartIds.includes(p))
						.map((p) => (
							<label key={ p }>
								<Checkbox checked={ false } onChange={ () => {
									layer.modifyDefinition((d) => {
										d.disabledTemplateParts = d.disabledTemplateParts?.filter((part) => part !== p);
									});
								} } />
								<s>{ p }</s>
							</label>
						))
				}
			</Column>
		</fieldset>
	);
}

function LayerAutomeshGraphicalLayers({ layer }: {
	layer: EditorAssetGraphicsWornLayer<'autoMesh'>;
}): ReactElement {
	const { graphicalLayers } = useObservable(layer.definition);

	const addGraphicalLayer = useCallback(() => {
		layer.modifyDefinition((d) => {
			d.graphicalLayers.push({
				name: '',
			});

			// Update all images
			for (const image of Object.values(d.imageMap)) {
				if (image.length < d.graphicalLayers.length) {
					image.push('');
				}
			}
		});
	}, [layer]);

	return (
		<Column>
			<Column gap='small'>
				{
					graphicalLayers.map((l, index) => (
						<LayerAutomeshGraphicalLayerItem key={ index }
							graphicalLayer={ l }
							index={ index }
							layer={ layer }
							update={ (producer) => {
								layer.modifyDefinition((d) => {
									Assert(d.graphicalLayers.length > index);
									producer(d.graphicalLayers[index]);
								});
							} }
							remove={ () => {
								layer.modifyDefinition((d) => {
									Assert(d.graphicalLayers.length > index);
									const previousLength = d.graphicalLayers.length;
									d.graphicalLayers.splice(index, 1);

									for (const image of Object.values(d.imageMap)) {
										if (image.length === previousLength) {
											image.splice(index, 1);
										}
									}
								});
							} }
						/>
					))
				}
			</Column>
			<Button slim onClick={ addGraphicalLayer }>
				Add graphical layer
			</Button>
		</Column>
	);
}

function LayerAutomeshGraphicalLayerItem({ graphicalLayer, layer, index, update, remove }: {
	graphicalLayer: Immutable<GraphicsSourceAutoMeshGraphicalLayer>;
	layer: EditorAssetGraphicsWornLayer<'autoMesh'>;
	index: number;
	update: (producer: (d: Draft<GraphicsSourceAutoMeshGraphicalLayer>) => void) => void;
	remove: () => void;
}): ReactElement {
	return (
		<Column className='editor-highlightedArea' padding='small'>
			<Row alignY='center'>
				<TextInput
					value={ graphicalLayer.name }
					placeholder={ `Layer #${index + 1}` }
					onChange={ (newValue) => {
						update((d) => {
							d.name = newValue.trim();
						});
					} }
					className='zero-width flex-1'
				/>
				<IconButton
					src={ crossIcon }
					className='smallIconButton'
					alt='Remove entry'
					onClick={ remove }
					slim
				/>
			</Row>
			<LayerAutomeshGraphicalLayerItemColorization
				value={ graphicalLayer.colorizationKey ?? '' }
				onChange={ (newValue) => {
					update((d) => {
						d.colorizationKey = newValue || undefined;
					});
				} }
				layer={ layer }
			/>
		</Column>
	);
}

function LayerAutomeshGraphicalLayerItemColorization({ value, onChange, layer }: {
	value: string;
	onChange: (newValue: string) => void;
	layer: EditorAssetGraphicsWornLayer<'autoMesh'>;
}): ReactElement | null {
	const assetManager = useAssetManager();
	const asset = assetManager.getAssetById(layer.assetGraphics.id);
	const id = useId();

	if (asset == null || !(asset.isType('personal') || asset.isType('bodypart') || asset.isType('roomDevice')))
		return null;

	const colorization = asset.definition.colorization;

	const elements: ReactElement[] = [];
	for (const [colorId, color] of Object.entries(colorization ?? {})) {
		elements.push(
			<option value={ colorId } key={ colorId }>{ color.name || `${colorId} (hidden)` }{ ('group' in color && typeof color.group === 'string') ? ` (group: '${color.group}')` : '' }</option>,
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
			>
				<option value='' key='!empty'>- None -</option>
				{ elements }
			</Select>
		</Row>
	);
}

function LayerAutomeshVariables({ layer }: { layer: EditorAssetGraphicsWornLayer<'autoMesh'>; }): ReactElement | null {
	const assetManager = useAssetManager();
	const asset = assetManager.getAssetById(layer.assetGraphics.id);

	const [showAddVariableDialog, setShowAddVariableDialog] = useState(false);

	const { variables } = useObservable(layer.definition);

	const buildContext = useMemo(() => (asset != null && (asset.isType('personal') || asset.isType('bodypart') || asset.isType('roomDevice')) ?
		EditorBuildAssetGraphicsWornContext(layer.assetGraphics, asset, assetManager, EditorAssetGraphicsManager) :
		null
	), [asset, assetManager, layer.assetGraphics]);

	const addVariable = useCallback((newVariable: GraphicsSourceAutoMeshLayerVariable) => {
		if (buildContext == null)
			return;

		const existingVariants: AutoMeshLayerGenerateVariableValue[][] = [];

		for (const variable of variables) {
			const values = AutoMeshLayerGenerateVariableData(variable, buildContext);
			Assert(values.length > 0, 'Generating variable variants returned empty result');
			existingVariants.push(values);
		}

		const newVariants = AutoMeshLayerGenerateVariableData(newVariable, buildContext);
		Assert(newVariants.length > 0, 'Generating variable variants returned empty result');

		layer.modifyDefinition((d) => {
			d.variables.push(newVariable);

			// Update all images
			const newImages: Record<string, string[]> = {};

			for (const combination of (existingVariants.length > 0 ? GenerateMultipleListsFullJoin(existingVariants) : [[GRAPHICS_AUTOMESH_LAYER_DEFAULT_VARIANT]])) {
				const oldIdParts = combination.map((c) => c.id);
				const oldId = oldIdParts.join(':');
				for (const newVariant of newVariants) {
					const newId = existingVariants.length > 0 ? ([...oldIdParts, newVariant.id]).join(':') : newVariant.id;
					newImages[newId] = d.imageMap[oldId];
				}
			}

			d.imageMap = newImages;

		});
	}, [buildContext, layer, variables]);

	const reorderVariable = useCallback((startIndex: number, shift: number) => {
		if (buildContext == null ||
			startIndex < 0 ||
			startIndex >= variables.length ||
			(startIndex + shift) < 0 ||
			(startIndex + shift) >= variables.length
		) {
			return;
		}

		const existingVariants: AutoMeshLayerGenerateVariableValue[][] = [];

		const reorderedVariables = variables.toSpliced(startIndex, 1);
		reorderedVariables.splice(startIndex + shift, 0, variables[startIndex]);

		for (const variable of reorderedVariables) {
			const values = AutoMeshLayerGenerateVariableData(variable, buildContext);
			Assert(values.length > 0, 'Generating variable variants returned empty result');
			existingVariants.push(values);
		}

		layer.modifyDefinition((d) => {
			d.variables = castDraft(reorderedVariables);

			// Update all images
			const newImages: Record<string, string[]> = {};

			for (const combination of (existingVariants.length > 0 ? GenerateMultipleListsFullJoin(existingVariants) : [[GRAPHICS_AUTOMESH_LAYER_DEFAULT_VARIANT]])) {
				const newIdParts = combination.map((c) => c.id);
				// Get original id by reordering parts in reverse
				const oldIdParts = newIdParts.slice();
				{
					const shiftedPart = oldIdParts.splice(startIndex + shift, 1);
					if (shift != null) {
						oldIdParts.splice(startIndex, 0, ...shiftedPart);
					}
				}
				const oldId = oldIdParts.join(':');
				const newId = newIdParts.join(':');
				if (Object.hasOwn(d.imageMap, oldId)) {
					Assert(!Object.hasOwn(newImages, newId));
					newImages[newId] = d.imageMap[oldId];
				}
			}

			d.imageMap = newImages;

		});
	}, [buildContext, layer, variables]);

	const removeVariable = useCallback((startIndex: number, keepId: string) => {
		if (buildContext == null ||
			startIndex < 0 ||
			startIndex >= variables.length
		) {
			return;
		}

		const existingVariants: AutoMeshLayerGenerateVariableValue[][] = [];

		const updatedVariables = variables.toSpliced(startIndex, 1);
		for (const variable of updatedVariables) {
			const values = AutoMeshLayerGenerateVariableData(variable, buildContext);
			Assert(values.length > 0, 'Generating variable variants returned empty result');
			existingVariants.push(values);
		}

		layer.modifyDefinition((d) => {
			d.variables = castDraft(updatedVariables);

			// Update all images
			const newImages: Record<string, string[]> = {};

			for (const combination of (existingVariants.length > 0 ? GenerateMultipleListsFullJoin(existingVariants) : [[GRAPHICS_AUTOMESH_LAYER_DEFAULT_VARIANT]])) {
				const newIdParts = combination.map((c) => c.id);
				// Get original id by using the variant specified in "keepId"
				const oldIdParts = newIdParts.toSpliced(startIndex, 0, keepId);
				const oldId = oldIdParts.join(':');
				const newId = newIdParts.join(':');
				if (Object.hasOwn(d.imageMap, oldId)) {
					Assert(!Object.hasOwn(newImages, newId));
					newImages[newId] = d.imageMap[oldId];
				}
			}

			d.imageMap = newImages;

		});
	}, [buildContext, layer, variables]);

	const updateVariable = useCallback((index: number, newValue: Immutable<GraphicsSourceAutoMeshLayerVariable>) => {
		if (buildContext == null ||
			index < 0 ||
			index >= variables.length
		) {
			return;
		}

		layer.modifyDefinition((d) => {
			d.variables[index] = castDraft(newValue);

			// TODO: Figure out how to update all images
		});
	}, [buildContext, layer, variables]);

	if (asset == null || !(asset.isType('personal') || asset.isType('bodypart') || asset.isType('roomDevice')) || buildContext == null)
		return null;

	return (
		<Column>
			<Column gap='small'>
				{
					variables.map((v, index) => (
						<LayerAutomeshVariableItem key={ index }
							index={ index }
							variable={ v }
							buildContext={ buildContext }
							update={ (newValue) => {
								updateVariable(index, newValue);
							} }
							remove={ (keepId) => {
								removeVariable(index, keepId);
							} }
							reorder={ (shift) => {
								reorderVariable(index, shift);
							} }
						/>
					))
				}
			</Column>
			<Button slim onClick={ () => setShowAddVariableDialog(true) }>
				Add variable
			</Button>
			{
				showAddVariableDialog ? (
					<LayerAutomeshVariableAddDialog
						addVariable={ addVariable }
						layer={ layer }
						asset={ asset }
						close={ () => setShowAddVariableDialog(false) }
					/>
				) : null
			}
		</Column>
	);
}

function LayerAutomeshVariableItem({ variable, buildContext, index, update, remove, reorder }: {
	variable: Immutable<GraphicsSourceAutoMeshLayerVariable>;
	buildContext: GraphicsBuildContext<Immutable<GraphicsBuildContextAssetData>>;
	index: number;
	update: (newValue: Immutable<GraphicsSourceAutoMeshLayerVariable>) => void;
	remove: (keepId: string) => void;
	reorder: (shift: number) => void;
}): ReactElement {
	const [removeDialog, setRemoveDialog] = useState(false);

	return (
		<Row alignY='center' className='editor-highlightedArea' padding='small'>
			{
				variable.type === 'bone' ? (
					<Column className='flex-1'>
						<Row alignY='center' gap='small'>
							<span>
								Based on rotation of bone <code>{ variable.bone }</code>
							</span>
							<ContextHelpButton>
								<p>
									This variable will produce several image variants based on possible rotations of a given bone.<br />
									To make use of this, enter the points where the image should change in the range of { BONE_MIN } to { BONE_MAX }<br />
									as one or more values, separated by comma.
								</p>
								<p>
									Example: <code>0, 90</code><br />
									This will produce three ranges with one image assigned to each:
								</p>
								<ul>
									<li><code>{ BONE_MIN }</code> to <code>-1</code></li>
									<li><code>0</code> to <code>89</code></li>
									<li><code>90</code> to <code>{ BONE_MAX }</code></li>
								</ul>
							</ContextHelpButton>
						</Row>
						<TextInput
							value={ variable.stops.map((s) => s.toString(10)).join(', ') }
							onChange={ (newValue) => {
								const newStops = newValue
									.split(',')
									.map((s) => s.trim())
									.filter(Boolean)
									.map((s) => Number.parseInt(s, 10))
									.filter((s) => Number.isSafeInteger(s) && s > BONE_MIN && s <= BONE_MAX);
								update(produce(variable, (d) => {
									d.stops = newStops;
								}));
							} }
						/>
					</Column>
				) :
				variable.type === 'typedModule' ? (
					<span className='flex-1'>Based on typed module '{ variable.module }'</span>
				) :
				variable.type === 'attribute' ? (
					<span className='flex-1'>Based on presence of attribute '{ variable.attribute }'</span>
				) :
				variable.type === 'view' ? (
					<span className='flex-1'>Based on front/back view</span>
				) :
				variable.type === 'armRotation' ? (
					<span className='flex-1'>Based on the rotation of the { variable.side } arm</span>
				) :
				variable.type === 'armFingers' ? (
					<span className='flex-1'>Based on the fingers of the { variable.side } arm</span>
				) :
				variable.type === 'legsState' ? (
					<span className='flex-1'>Based on the state of the legs</span>
				) :
				variable.type === 'blink' ? (
					<span className='flex-1'>Based on eyes blinking</span>
				) :
				AssertNever(variable)
			}
			<Button className='slim' disabled={ index === 0 } aria-label='move' onClick={ () => reorder(-1) } title='Move up'>
				↑
			</Button>
			<IconButton
				src={ crossIcon }
				className='smallIconButton'
				alt='Remove entry'
				onClick={ () => {
					setRemoveDialog(true);
				} }
				slim
			/>
			{ removeDialog ? (
				<ModalDialog>
					<Column>
						<div>Select which variant of this variable to keep</div>
						<Column className='editor-highlightedArea' padding='medium'>
							{ AutoMeshLayerGenerateVariableData(variable, buildContext).map((variant) => (
								<Button
									key={ variant.id }
									onClick={ () => {
										remove(variant.id);
										setRemoveDialog(false);
									} }
								>
									{ variant.name } ({ variant.id })
								</Button>
							)) }
						</Column>
						<Button onClick={ () => {
							setRemoveDialog(false);
						} }>
							Cancel
						</Button>
					</Column>
				</ModalDialog>
			) : null }
		</Row>
	);
}

function LayerAutomeshVariableAddDialog({ close, layer, asset, addVariable }: {
	close: () => void;
	layer: EditorAssetGraphicsWornLayer<'autoMesh'>;
	asset: Asset<'personal'> | Asset<'bodypart'> | Asset<'roomDevice'>;
	addVariable: (newVariable: GraphicsSourceAutoMeshLayerVariable) => void;
}): ReactElement {
	const assetManager = useAssetManagerEditor();
	const [selectedType, setSelectedType] = useState<GraphicsSourceAutoMeshLayerVariable['type'] | null>(null);

	const buildContext = EditorBuildAssetGraphicsWornContext(layer.assetGraphics, asset, assetManager, EditorAssetGraphicsManager);

	return (
		<ModalDialog>
			<Column>
				<Row padding='small'>
					<Column className='editor-highlightedArea' padding='small'>
						<Button
							theme={ selectedType === 'typedModule' ? 'defaultActive' : 'default' }
							onClick={ () => {
								setSelectedType('typedModule');
							} }
						>
							Based on typed module
						</Button>
						<Button
							theme={ selectedType === 'attribute' ? 'defaultActive' : 'default' }
							onClick={ () => {
								setSelectedType('attribute');
							} }
						>
							Based on presence of attribute
						</Button>
						<Button
							theme={ selectedType === 'view' ? 'defaultActive' : 'default' }
							onClick={ () => {
								setSelectedType('view');
							} }
						>
							Based on front/back view
						</Button>
						<Button
							theme={ selectedType === 'armRotation' ? 'defaultActive' : 'default' }
							onClick={ () => {
								setSelectedType('armRotation');
							} }
						>
							Based on arm rotation
						</Button>
						<Button
							theme={ selectedType === 'armFingers' ? 'defaultActive' : 'default' }
							onClick={ () => {
								setSelectedType('armFingers');
							} }
						>
							Based on arm finger state
						</Button>
						<Button
							theme={ selectedType === 'legsState' ? 'defaultActive' : 'default' }
							onClick={ () => {
								setSelectedType('legsState');
							} }
						>
							Based on legs state
						</Button>
						<Button
							theme={ selectedType === 'blink' ? 'defaultActive' : 'default' }
							onClick={ () => {
								setSelectedType('blink');
							} }
						>
							Based on eye blinking
						</Button>
						<Button
							theme={ selectedType === 'bone' ? 'defaultActive' : 'default' }
							onClick={ () => {
								setSelectedType('bone');
							} }
						>
							Based on bone rotation
						</Button>
					</Column>
					{
						selectedType === 'typedModule' ? (
							<Column className='editor-highlightedArea' padding='small'>
								{
									KnownObject.entries(buildContext.builtAssetData.modules ?? {})
										.filter(([,definition]) => definition.type === 'typed')
										.map(([module, definition]) => (
											<Button
												key={ module }
												onClick={ () => {
													addVariable({
														type: 'typedModule',
														module,
													});
													close();
												} }
											>
												{ definition.name } ({ module })
											</Button>
										))
								}
							</Column>
						) :
						selectedType === 'attribute' ? (
							<Column className='editor-highlightedArea attributeList' padding='small' overflowY='scroll'>
								<Column>
									{
										[...assetManager.attributes.entries()]
											.map(([a, definition]) => (
												<button
													key={ a }
													className='inventoryViewItem listMode small allowed'
													data-attribute-id={ a }
													onClick={ () => {
														addVariable({
															type: 'attribute',
															attribute: a,
														});
														close();
													} }>
													<InventoryAttributePreview attribute={ a } />
													<span className='itemName'>{ definition.name }</span>
												</button>
											))
									}
								</Column>
							</Column>
						) :
						selectedType === 'view' ? (
							<Column className='editor-highlightedArea' padding='small'>
								<Button
									onClick={ () => {
										addVariable({
											type: 'view',
										});
										close();
									} }
								>
									Front/Back
								</Button>
							</Column>
						) :
						selectedType === 'armRotation' ? (
							<Column className='editor-highlightedArea' padding='small'>
								{
									(['left', 'right'] as const).map((side, i) => (
										<Button
											key={ side }
											onClick={ () => {
												addVariable({
													type: 'armRotation',
													side,
												});
												close();
											} }
										>
											{ capitalize(side) }{ i === 0 ? ' (primary)' : null }
										</Button>
									))
								}
							</Column>
						) :
						selectedType === 'armFingers' ? (
							<Column className='editor-highlightedArea' padding='small'>
								{
									(['left', 'right'] as const).map((side, i) => (
										<Button
											key={ side }
											onClick={ () => {
												addVariable({
													type: 'armFingers',
													side,
												});
												close();
											} }
										>
											{ capitalize(side) }{ i === 0 ? ' (primary)' : null }
										</Button>
									))
								}
							</Column>
						) :
						selectedType === 'legsState' ? (
							<Column className='editor-highlightedArea' padding='small'>
								<Button
									onClick={ () => {
										addVariable({
											type: 'legsState',
										});
										close();
									} }
								>
									{ LegsPoseSchema.options.map(capitalize).join('/') }
								</Button>
							</Column>
						) :
						selectedType === 'blink' ? (
							<Column className='editor-highlightedArea' padding='small'>
								<Button
									onClick={ () => {
										addVariable({
											type: 'blink',
										});
										close();
									} }
								>
									Blinking
								</Button>
							</Column>
						) :
						selectedType === 'bone' ? (
							<Column className='editor-highlightedArea' padding='small'>
								{
									assetManager.getAllBones()
										.map(({ name }) => (
											<Button
												key={ name }
												onClick={ () => {
													addVariable({
														type: 'bone',
														bone: name,
														stops: [],
													});
													close();
												} }
											>
												{ name }
											</Button>
										))
								}
							</Column>
						) :
						selectedType === null ? (
							null
						) :
						AssertNever(selectedType)
					}
				</Row>
				<Button onClick={ () => {
					close();
				} }>
					Cancel
				</Button>
			</Column>
		</ModalDialog>
	);
}

function LayerAutomeshImages({ layer }: { layer: EditorAssetGraphicsWornLayer<'autoMesh'>; }): ReactElement | null {
	const assetManager = useAssetManager();
	const asset = assetManager.getAssetById(layer.assetGraphics.id);
	const id = useId();
	const { variables, graphicalLayers, imageMap } = useObservable(layer.definition);
	const assetTextures = useObservable(layer.assetGraphics.textures);

	const [autofillDialogTarget, setAutofillDialogTarget] = useState<null | true | string>(null);
	const [autofillPrefixes, setAutofillPrefixes] = useState<readonly string[]>([]);

	const imageSelectElements = useMemo((): readonly ReactElement[] => [
		<option value='' key=''>[ None ]</option>,
		...(
			Array.from(assetTextures.keys())
				.filter(Boolean)
				.toSorted(SortPathStrings)
				.map((image) => (
					<option value={ image } key={ image }>{ image }</option>
				))
		),
	], [assetTextures]);

	if (asset == null || !(asset.isType('personal') || asset.isType('bodypart') || asset.isType('roomDevice')))
		return null;

	const buildContext = EditorBuildAssetGraphicsWornContext(layer.assetGraphics, asset, assetManager, EditorAssetGraphicsManager);
	const variants: AutoMeshLayerGenerateVariableValue[][] = [];

	for (const variable of variables) {
		const values = AutoMeshLayerGenerateVariableData(variable, buildContext);
		Assert(values.length > 0, 'Generating variable variants returned empty result');
		variants.push(values);
	}

	const uiVariants: ReactElement[] = [];
	const validCombinationIds = new Set<string>();
	const missingCombinations = new Map<string, string>();

	for (const combination of (variants.length > 0 ? GenerateMultipleListsFullJoin(variants) : [[GRAPHICS_AUTOMESH_LAYER_DEFAULT_VARIANT]])) {
		const combinationId = combination.map((c) => c.id).join(':');
		const combinationName = combination.map((c) => c.name).join(' | ');
		validCombinationIds.add(combinationId);

		const imageLayers: (readonly string[]) | undefined = imageMap[combinationId];
		if (imageLayers == null) {
			missingCombinations.set(combinationId, combinationName);
			uiVariants.push(
				<Column key={ combinationId }>
					<strong>{ combinationName }</strong>
					<span>Error: Missing mapped image for generated combination</span>
					<Button onClick={ () => {
						layer.modifyDefinition((d) => {
							Assert(d.imageMap[combinationId] == null);
							d.imageMap[combinationId] = new Array<string>(graphicalLayers.length).fill('');
						});
					} } slim>
						Add mapping
					</Button>
				</Column>,
			);
		} else if (imageLayers.length !== graphicalLayers.length) {
			uiVariants.push(
				<Column key={ combinationId }>
					<strong>{ combinationName }</strong>
					<span>Error: Mapped image combination does not match graphical layer count for combination</span>
				</Column>,
			);
		} else {
			uiVariants.push(
				<Column key={ combinationId }>
					<strong>{ combinationName }</strong>
					<Row alignX='start'>
						<Button
							slim
							onClick={ () => {
								setAutofillDialogTarget(combinationId);
							} }
						>
							🪄 Auto-fill this combination
						</Button>
					</Row>
					{
						graphicalLayers.map((l, li) => (
							<Row key={ li } alignY='center'>
								<label htmlFor={ `${id}-${combinationId}-${li}` }>
									{ l.name || `Layer #${li + 1}` }
								</label>
								<Select
									id={ `${id}-${combinationId}-${li}` }
									className='zero-width flex-1'
									value={ imageLayers[li] }
									onChange={ (event) => {
										layer.modifyDefinition((d) => {
											const map = d.imageMap[combinationId];
											Assert(map != null, 'Failed to get map');
											Assert(map.length === graphicalLayers.length);
											map[li] = event.target.value;
										});
									} }
								>
									{ imageSelectElements }
								</Select>
							</Row>
						))
					}
				</Column>,
			);
		}
	}

	return (
		<Column gap='large'>
			{
				Object.keys(imageMap)
					.filter((k) => !validCombinationIds.has(k))
					.map((k) => (
						<Column key={ k }>
							<strong>{ k }</strong>
							<span>Error: Unknown variant</span>
							{
								(missingCombinations.size > 0 && imageMap[k]?.length === graphicalLayers.length) ? (
									<Row alignY='center'>
										<label htmlFor={ `${id}-${k}-remap` }>
											Remap to:
										</label>
										<Select
											id={ `${id}-${k}-remap` }
											className='flex-1'
											value=''
											onChange={ (event) => {
												if (!event.target.value)
													return;
												layer.modifyDefinition((d) => {
													const map = d.imageMap[k];
													Assert(map != null, 'Failed to get map');
													Assert(map.length === graphicalLayers.length);
													d.imageMap[event.target.value] = map;
													delete d.imageMap[k];
												});
											} }
										>
											<option value=''>- Select variant -</option>
											{
												Array.from(missingCombinations).map(([variant, variantName]) => (
													<option key={ variant } value={ variant }>{ variantName }</option>
												))
											}
										</Select>
									</Row>
								) : null
							}
							<Button onClick={ () => {
								layer.modifyDefinition((d) => {
									delete d.imageMap[k];
								});
							} } slim>
								Delete
							</Button>
						</Column>
					))
			}
			<Row alignX='start'>
				<Button
					slim
					onClick={ () => {
						setAutofillDialogTarget(true);
					} }
				>
					🪄 Auto-fill all images
				</Button>
			</Row>
			{ uiVariants }
			{
				autofillDialogTarget != null ? (
					<LayerAutomeshFillImagesDialog
						layer={ layer }
						asset={ asset }
						close={ () => {
							setAutofillDialogTarget(null);
						} }
						prefixes={ autofillPrefixes }
						setPrefixes={ setAutofillPrefixes }
						limitToCombination={ typeof autofillDialogTarget === 'string' && validCombinationIds.has(autofillDialogTarget) ? autofillDialogTarget : undefined }
					/>
				) : null
			}
		</Column>
	);
}

function LayerAutomeshFillImagesDialog({ layer, asset, close, prefixes, setPrefixes, limitToCombination }: {
	layer: EditorAssetGraphicsWornLayer<'autoMesh'>;
	asset: Asset<'personal'> | Asset<'bodypart'> | Asset<'roomDevice'>;
	close: () => void;
	prefixes: readonly string[];
	setPrefixes: React.Dispatch<React.SetStateAction<readonly string[]>>;
	limitToCombination?: string;
}): ReactElement {
	Assert(layer.assetGraphics.id === asset.id);

	const [overwriteAll, setOverwriteAll] = useState(false);

	const assetManager = useAssetManager();
	const { variables, graphicalLayers } = useObservable(layer.definition);
	const assetTextures = useObservable(layer.assetGraphics.textures);

	useEffect(() => {
		if (graphicalLayers.length !== prefixes.length) {
			setPrefixes(graphicalLayers.map((l) => snakeCase(l.name)));
		}
	}, [graphicalLayers, prefixes, setPrefixes]);

	const combinations = useMemo(() => {
		const buildContext = EditorBuildAssetGraphicsWornContext(layer.assetGraphics, asset, assetManager, EditorAssetGraphicsManager);
		const variants: AutoMeshLayerGenerateVariableValue[][] = [];

		for (const variable of variables) {
			const values = AutoMeshLayerGenerateVariableData(variable, buildContext);
			Assert(values.length > 0, 'Generating variable variants returned empty result');
			variants.push(values);
		}
		return (variants.length > 0 ? Array.from(GenerateMultipleListsFullJoin(variants)) : [[GRAPHICS_AUTOMESH_LAYER_DEFAULT_VARIANT]]);
	}, [layer, asset, assetManager, variables]);

	const apply = useCallback(() => {
		if (prefixes.length !== graphicalLayers.length)
			return;

		const validCombinationIds = new Set<string>();

		layer.modifyDefinition((d) => {
			for (const combination of combinations) {
				const combinationId = combination.map((c) => c.id).join(':');
				validCombinationIds.add(combinationId);

				if (limitToCombination != null && limitToCombination !== combinationId)
					continue;

				let imageLayers: string[] | undefined = d.imageMap[combinationId];
				if (overwriteAll || imageLayers == null || imageLayers.length !== graphicalLayers.length) {
					imageLayers = new Array<string>(graphicalLayers.length).fill('');
				}

				for (let gli = 0; gli < graphicalLayers.length; gli++) {
					const image = [prefixes[gli], ...combination.map((s) => s.id)].join('_') + '.png';
					if (!imageLayers[gli] && assetTextures.has(image)) {
						imageLayers[gli] = image;
					}
				}

				d.imageMap[combinationId] = imageLayers;
			}

			if (limitToCombination == null) {
				for (const key of Object.keys(d.imageMap)) {
					if (!validCombinationIds.has(key)) {
						delete d.imageMap[key];
					}
				}
			}
		});

		close();
	}, [combinations, graphicalLayers, assetTextures, layer, prefixes, overwriteAll, limitToCombination, close]);

	return (
		<ModalDialog>
			<Column>
				<h2>Automatically fill images based on name</h2>
				<span className='contain-inline-size'>
					<p>
						This will take names of the layers below and the ids of each variable and join them using '_' to try finding matching images.
					</p>
					<p>
						To make it work, the file names of your images should start with the layer name as a prefix, followed by the module values, separated by an underscore.<br />
						If your layer for instance is "ring" and has a module based on material and based on front/back view, a file name could be
						"ring_rubber_back.png"
					</p>
					Any wrongly-formatted combination will be reset, otherwise the setting below is followed.
				</span>
				<label>
					<Checkbox
						checked={ overwriteAll }
						onChange={ setOverwriteAll }
					/>
					Reset all assignments
				</label>
				<table>
					<thead>
						<tr>
							<th>Layer</th>
							<th>Prefix</th>
							<th>Matches</th>
						</tr>
					</thead>
					<tbody>
						{
							graphicalLayers.map((l, i) => (
								<tr key={ i }>
									<td>{ l.name }</td>
									<td>
										<TextInput
											value={ prefixes.length === graphicalLayers.length ? prefixes[i] : '' }
											disabled={ prefixes.length !== graphicalLayers.length }
											onChange={ (newValue) => {
												setPrefixes((v) => produce(v, (d) => {
													Assert(d.length === graphicalLayers.length);
													d[i] = newValue;
												}));
											} }
										/>
									</td>
									<td>
										{
											combinations.reduce<number>((count, c) => {
												const prefix = prefixes.length === graphicalLayers.length ? prefixes[i] : '';
												if (!prefix || limitToCombination != null && limitToCombination !== c.map((s) => s.id).join(':'))
													return count;
												const image = [prefix, ...c.map((s) => s.id)].join('_') + '.png';
												return count + (assetTextures.has(image) ? 1 : 0);
											}, 0)
										}
									</td>
								</tr>
							))
						}
					</tbody>
				</table>
				<Row alignX='space-between'>
					<Button
						onClick={ close }
					>
						Cancel
					</Button>
					<Button
						onClick={ apply }
						disabled={ prefixes.length !== graphicalLayers.length }
					>
						Apply
					</Button>
				</Row>
			</Column>
		</ModalDialog>
	);
}
