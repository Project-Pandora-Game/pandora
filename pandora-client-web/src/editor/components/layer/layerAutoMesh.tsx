import type { Draft, Immutable } from 'immer';
import { capitalize } from 'lodash-es';
import {
	Assert,
	AssertNever,
	AutoMeshLayerGenerateVariableData,
	GenerateMultipleListsFullJoin,
	GRAPHICS_AUTOMESH_LAYER_DEFAULT_VARIANT,
	KnownObject,
	LegsPoseSchema,
	type Asset,
	type AutoMeshLayerGenerateVariableValue,
	type GraphicsSourceAutoMeshGraphicalLayer,
	type GraphicsSourceAutoMeshLayerVariable,
} from 'pandora-common';
import { useCallback, useId, useState, type ReactElement } from 'react';
import { useAssetManager } from '../../../assets/assetManager.tsx';
import crossIcon from '../../../assets/icons/cross.svg';
import { Checkbox } from '../../../common/userInteraction/checkbox.tsx';
import { TextInput } from '../../../common/userInteraction/input/textInput.tsx';
import { Select } from '../../../common/userInteraction/select/select.tsx';
import { Button, IconButton } from '../../../components/common/button/button.tsx';
import { Column, Row } from '../../../components/common/container/container.tsx';
import { Tab, TabContainer } from '../../../components/common/tabs/tabs.tsx';
import { ModalDialog } from '../../../components/dialog/dialog.tsx';
import { ContextHelpButton } from '../../../components/help/contextHelpButton.tsx';
import { InventoryAttributePreview } from '../../../components/wardrobe/wardrobeComponents.tsx';
import { useObservable } from '../../../observable.ts';
import { useAssetManagerEditor } from '../../assets/assetManager.ts';
import type { EditorAssetGraphics } from '../../assets/editorAssetGraphics.ts';
import { EditorBuildAssetGraphicsContext } from '../../assets/editorAssetGraphicsBuilding.ts';
import type { EditorAssetGraphicsLayer } from '../../assets/editorAssetGraphicsLayer.ts';
import { useEditorPointTemplates } from '../../assets/editorAssetGraphicsManager.ts';
import { LayerHeightAndWidthSetting, LayerOffsetSetting } from './layerCommon.tsx';

export function LayerAutoMeshUI({ asset, layer }: {
	asset: EditorAssetGraphics;
	layer: EditorAssetGraphicsLayer<'autoMesh'>;
}): ReactElement {
	return (
		<>
			<hr />
			<LayerHeightAndWidthSetting layer={ layer } asset={ asset } />
			<LayerOffsetSetting layer={ layer } asset={ asset } />
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

function LayerTemplateSelect({ layer }: { layer: EditorAssetGraphicsLayer<'autoMesh'>; }): ReactElement | null {
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

function LayerAutomeshTemplateSelect({ layer }: { layer: EditorAssetGraphicsLayer<'autoMesh'>; }): ReactElement {
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
					noScrollChange
				>
					<option value='' key='!empty'>- Select a template -</option>
					{ elements }
				</Select>
			</Row>
			<span>For templates with mirrored parts, configure primarily for <strong>LEFT</strong> side.</span>
		</>
	);
}

function LayerAutomeshPartsDiable({ layer }: { layer: EditorAssetGraphicsLayer<'autoMesh'>; }): ReactElement {
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

function LayerAutomeshGraphicalLayers({ layer }: { layer: EditorAssetGraphicsLayer<'autoMesh'>; }): ReactElement {
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
	layer: EditorAssetGraphicsLayer<'autoMesh'>;
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
					className='flex-1'
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
	layer: EditorAssetGraphicsLayer<'autoMesh'>;
}): ReactElement | null {
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

function LayerAutomeshVariables({ layer }: { layer: EditorAssetGraphicsLayer<'autoMesh'>; }): ReactElement | null {
	const assetManager = useAssetManager();
	const asset = assetManager.getAssetById(layer.asset.id);

	const [showAddVariableDialog, setShowAddVariableDialog] = useState(false);

	const { variables } = useObservable(layer.definition);

	const addVariable = useCallback((newVariable: GraphicsSourceAutoMeshLayerVariable) => {
		if (asset == null)
			return;

		const buildContext = EditorBuildAssetGraphicsContext(layer.asset, asset);
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
	}, [asset, layer, variables]);

	const reorderVariable = useCallback((startIndex: number, shift: number | null) => {
		if (asset == null ||
			startIndex < 0 ||
			startIndex >= variables.length ||
			shift != null && (startIndex + shift) < 0 ||
			shift != null && (startIndex + shift) >= variables.length
		) {
			return;
		}

		const buildContext = EditorBuildAssetGraphicsContext(layer.asset, asset);
		const existingVariants: AutoMeshLayerGenerateVariableValue[][] = [];

		for (const variable of variables) {
			const values = AutoMeshLayerGenerateVariableData(variable, buildContext);
			Assert(values.length > 0, 'Generating variable variants returned empty result');
			existingVariants.push(values);
		}

		layer.modifyDefinition((d) => {
			const shifted = d.variables.splice(startIndex, 1);
			if (shift != null) {
				d.variables.splice(startIndex + shift, 0, ...shifted);
			}

			// Update all images
			const newImages: Record<string, string[]> = {};

			for (const combination of (existingVariants.length > 0 ? GenerateMultipleListsFullJoin(existingVariants) : [[GRAPHICS_AUTOMESH_LAYER_DEFAULT_VARIANT]])) {
				const oldIdParts = combination.map((c) => c.id);
				const newIdParts = oldIdParts.slice();
				{
					const shiftedPart = newIdParts.splice(startIndex, 1);
					if (shift != null) {
						newIdParts.splice(startIndex + shift, 0, ...shiftedPart);
					}
				}
				const oldId = oldIdParts.join(':');
				const newId = newIdParts.join(':');
				// If removing, take only first variant
				if (newImages[newId] != null) {
					continue;
				}
				newImages[newId] = d.imageMap[oldId];
			}

			d.imageMap = newImages;

		});
	}, [asset, layer, variables]);

	if (asset == null)
		return null;

	return (
		<Column>
			<Column gap='small'>
				{
					variables.map((v, index) => (
						<LayerAutomeshVariableItem key={ index }
							index={ index }
							variable={ v }
							remove={ () => {
								reorderVariable(index, null);
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

function LayerAutomeshVariableItem({ variable, index, remove, reorder }: {
	variable: Immutable<GraphicsSourceAutoMeshLayerVariable>;
	index: number;
	remove: () => void;
	reorder: (shift: number) => void;
}): ReactElement {
	return (
		<Row alignY='center' className='editor-highlightedArea' padding='small'>
			{
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
				🠉
			</Button>
			<IconButton
				src={ crossIcon }
				className='smallIconButton'
				alt='Remove entry'
				onClick={ remove }
				slim
			/>
		</Row>
	);
}

function LayerAutomeshVariableAddDialog({ close, layer, asset, addVariable }: {
	close: () => void;
	layer: EditorAssetGraphicsLayer<'autoMesh'>;
	asset: Asset;
	addVariable: (newVariable: GraphicsSourceAutoMeshLayerVariable) => void;
}): ReactElement {
	const assetManager = useAssetManagerEditor();
	const [selectedType, setSelectedType] = useState<GraphicsSourceAutoMeshLayerVariable['type'] | null>(null);

	const buildContext = EditorBuildAssetGraphicsContext(layer.asset, asset);

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
							Based on blinking
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
								{
									[...assetManager.attributes.entries()]
										.map(([a, definition]) => (
											<button
												key={ a }
												className='inventoryViewItem listMode small allowed'
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

function LayerAutomeshImages({ layer }: { layer: EditorAssetGraphicsLayer<'autoMesh'>; }): ReactElement | null {
	const assetManager = useAssetManager();
	const asset = assetManager.getAssetById(layer.asset.id);
	const id = useId();
	const { variables, graphicalLayers, imageMap } = useObservable(layer.definition);
	const imageList = useObservable(layer.asset.loadedTextures);

	if (asset == null)
		return null;

	const imageSelectElements: ReactElement[] = [<option value='' key=''>[ None ]</option>];
	for (const image of imageList.toSorted((a, b) => a.localeCompare(b))) {
		imageSelectElements.push(
			<option value={ image } key={ image }>{ image }</option>,
		);
	}

	const buildContext = EditorBuildAssetGraphicsContext(layer.asset, asset);
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
					{
						graphicalLayers.map((l, li) => (
							<Row key={ li } alignY='center'>
								<label htmlFor={ `${id}-${combinationId}-${li}` }>
									{ l.name || `Layer #${li + 1}` }
								</label>
								<Select
									id={ `${id}-${combinationId}-${li}` }
									className='flex-1'
									value={ imageLayers[li] }
									onChange={ (event) => {
										layer.modifyDefinition((d) => {
											const map = d.imageMap[combinationId];
											Assert(map != null, 'Failed to get map');
											Assert(map.length === graphicalLayers.length);
											map[li] = event.target.value;
										});
									} }
									noScrollChange
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
		<Column gap='medium'>
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
											noScrollChange
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
			{ uiVariants }
		</Column>
	);
}
