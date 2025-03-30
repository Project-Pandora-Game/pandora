import type { Draft, Immutable } from 'immer';
import {
	Assert,
	AssertNever,
	AutoMeshLayerGenerateVariableData,
	GenerateMultipleListsFullJoin,
	GRAPHICS_AUTOMESH_LAYER_DEFAULT_VARIANT,
	KnownObject,
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
import { useObservable } from '../../../observable.ts';
import type { EditorAssetGraphics } from '../../assets/editorAssetGraphics.ts';
import { EditorBuildAssetGraphicsContext } from '../../assets/editorAssetGraphicsBuilding.ts';
import type { EditorAssetGraphicsLayer } from '../../assets/editorAssetGraphicsLayer.ts';
import { EditorAssetGraphicsManager } from '../../assets/editorAssetGraphicsManager.ts';
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

function LayerAutomeshTemplateSelect({ layer }: { layer: EditorAssetGraphicsLayer<'autoMesh'>; }): ReactElement {
	const id = useId();
	const { automeshTemplate } = useObservable(layer.definition);
	const allAutomeshTemplates = useObservable(EditorAssetGraphicsManager.automeshTemplates);

	const elements: ReactElement[] = [];
	for (const [templateId, template] of Object.entries(allAutomeshTemplates)) {
		elements.push(
			<option value={ templateId } key={ templateId }>{ template.name }</option>,
		);
	}
	if (automeshTemplate && allAutomeshTemplates[automeshTemplate] == null) {
		elements.push(
			<option value={ automeshTemplate } key={ automeshTemplate }>[ ERROR: Unknown template '{ automeshTemplate }' ]</option>,
		);
	}

	return (
		<>
			<Row alignY='center'>
				<label htmlFor={ id }>
					Template:
					<ContextHelpButton>
						<p>
							This is a very important selector.<br />
							It lets you define how the whole layer behaves.
						</p>
						<p>
							The templates should be self-explanatory.<br />
							If you make any asset that should change alongside body changes,<br />
							you use 'body' - unless it is an asset where a more specialized<br />
							template exists, e.g. 'shirt' for tops, or short/long skirt.
						</p>
						<p>
							A special template is 'static'. This one covers the whole canvas<br />
							and does not use any transformations. That way, it can be used for images<br />
							that should always be on the same spot in the same size.<br />
							The 'static (split)' template covers left and right side of the character separately,<br />
							allowing you to configure only the left side while right side is generated automatically.
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
					id={ id }
					className='flex-1'
					value={ automeshTemplate }
					onChange={ (event) => {
						const value = event.target.value;
						if (value && allAutomeshTemplates[value] == null) {
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
	const { automeshTemplate, disabledTemplateParts } = useObservable(layer.definition);
	const allAutomeshTemplates = useObservable(EditorAssetGraphicsManager.automeshTemplates);

	const selectedTemplate = automeshTemplate ? allAutomeshTemplates[automeshTemplate] : undefined;
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

		const buildContext = EditorBuildAssetGraphicsContext(asset);
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

		const buildContext = EditorBuildAssetGraphicsContext(asset);
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
				AssertNever(variable.type)
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

function LayerAutomeshVariableAddDialog({ close, asset, addVariable }: {
	close: () => void;
	asset: Asset;
	addVariable: (newVariable: GraphicsSourceAutoMeshLayerVariable) => void;
}): ReactElement {
	const [selectedType, setSelectedType] = useState<GraphicsSourceAutoMeshLayerVariable['type'] | null>(null);

	const buildContext = EditorBuildAssetGraphicsContext(asset);

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
						) : null
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
	for (const image of imageList) {
		imageSelectElements.push(
			<option value={ image } key={ image }>{ image }</option>,
		);
	}

	const buildContext = EditorBuildAssetGraphicsContext(asset);
	const variants: AutoMeshLayerGenerateVariableValue[][] = [];

	for (const variable of variables) {
		const values = AutoMeshLayerGenerateVariableData(variable, buildContext);
		Assert(values.length > 0, 'Generating variable variants returned empty result');
		variants.push(values);
	}

	const uiVariants: ReactElement[] = [];

	for (const combination of (variants.length > 0 ? GenerateMultipleListsFullJoin(variants) : [[GRAPHICS_AUTOMESH_LAYER_DEFAULT_VARIANT]])) {
		const combinationId = combination.map((c) => c.id).join(':');
		const combinationName = combination.map((c) => c.name).join(' | ');

		const imageLayers: (readonly string[]) | undefined = imageMap[combinationId];
		if (imageLayers == null) {
			uiVariants.push(
				<Column key={ combinationId }>
					<strong>{ combinationName }</strong>
					<span>Error: Missing mapped image for generated combination</span>
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
			{ uiVariants }
		</Column>
	);
}
