import { castDraft, produce, type Draft, type Immutable } from 'immer';
import { snakeCase } from 'lodash-es';
import {
	Assert,
	AssertNever,
	EMPTY_ARRAY,
	GenerateMultipleListsFullJoin,
	GRAPHICS_ROOM_DEVICE_AUTO_SPRITE_LAYER_DEFAULT_VARIANT,
	IsNotNullable,
	KnownObject,
	RoomDeviceAutoSpriteLayerGenerateVariableData,
	SortPathStrings,
	type Asset,
	type AtomicCondition,
	type GraphicsBuildContext,
	type GraphicsBuildContextRoomDeviceData,
	type GraphicsSourceRoomDeviceAutoSpriteGraphicalLayer,
	type GraphicsSourceRoomDeviceAutoSpriteLayer,
	type GraphicsSourceRoomDeviceAutoSpriteLayerVariable,
	type RoomDeviceAutoSpriteLayerGenerateVariableValue,
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
import { Tab, TabContainer } from '../../../components/common/tabs/tabs.tsx';
import { ModalDialog } from '../../../components/dialog/dialog.tsx';
import { ContextHelpButton } from '../../../components/help/contextHelpButton.tsx';
import { useStandaloneConditionEvaluator } from '../../../graphics/appearanceConditionEvaluator.ts';
import { useObservable } from '../../../observable.ts';
import { useAssetManagerEditor } from '../../assets/assetManager.ts';
import { EditorBuildAssetGraphicsWornContext, EditorBuildAssetRoomDeviceGraphicsContext, EditorBuildAssetRoomDeviceGraphicsContextForDeployablePersonalAsset } from '../../assets/editorAssetGraphicsBuilding.ts';
import { EditorAssetGraphicsManager } from '../../assets/editorAssetGraphicsManager.ts';
import type { EditorAssetGraphicsRoomDeviceLayer } from '../../assets/editorAssetGraphicsRoomDeviceLayer.ts';
import { useEditorCharacterState } from '../../graphics/character/appearanceEditor.ts';
import { GetEditorConditionInputMetadataForAsset } from './conditionEditor.tsx';
import { LayerNormalMapSettings } from './layerAutoMesh.tsx';
import { LayerHeightAndWidthSetting, LayerOffsetSetting, SettingConditionOverrideTemplate, type SettingConditionOverrideTemplateDetails } from './layerCommon.tsx';

export function LayerRoomDeviceAutoSpriteUI({ layer }: {
	layer: EditorAssetGraphicsRoomDeviceLayer<'autoSprite'>;
}): ReactElement {
	const id = useId();
	const assetManager = useAssetManager();
	let asset = assetManager.getAssetById(layer.assetGraphics.id);
	if (asset != null && !asset.isType('roomDevice') && !asset.isType('personal'))
		asset = undefined;

	const {
		x, y,
		offsetOverrides,
		clipToRoom,
	} = useObservable(layer.definition);

	const characterState = useEditorCharacterState();
	const evaluator = useStandaloneConditionEvaluator();
	const item = characterState.items.filter((i) => i.isType('personal')).find((i) => i.asset.id === layer.assetGraphics.id) ??
		characterState.items.filter((i) => i.isType('roomDeviceWearablePart')).map((i) => i.roomDevice).filter(IsNotNullable).find((i) => i.asset.id === layer.assetGraphics.id);

	const evaluateCondition = useCallback((c: Immutable<AtomicCondition>) => {
		if ('module' in c && item == null)
			return undefined;

		return evaluator.evalCondition(c, item ?? null);
	}, [evaluator, item]);

	return (
		<>
			<hr />
			<LayerHeightAndWidthSetting layer={ layer } />
			<LayerOffsetSetting layer={ layer } />
			<h4>Offset overrides</h4>
			<SettingConditionOverrideTemplate<Immutable<NonNullable<GraphicsSourceRoomDeviceAutoSpriteLayer['offsetOverrides']>[number]>>
				overrides={ offsetOverrides ?? EMPTY_ARRAY }
				update={ (newOverrides) => {
					layer.modifyDefinition((d) => {
						if (newOverrides.length > 0) {
							d.offsetOverrides = castDraft(newOverrides);
						} else {
							delete d.offsetOverrides;
						}
					});
				} }
				EntryDetails={ SlotPositionOverridesDetail }
				getConditions={ (entry) => entry.condition }
				withConditions={ (entry, newConditions) => produce(entry, (d) => {
					d.condition = castDraft(newConditions);
				}) }
				makeNewEntry={ () => ({ offset: { x, y }, condition: [[]] }) }
				conditionEvalutator={ evaluateCondition }
				conditionsMetadata={ useMemo(() => asset != null ? GetEditorConditionInputMetadataForAsset(asset) : undefined, [asset]) }
			/>
			<hr />
			<Row alignY='center'>
				<Checkbox
					id={ id + ':clip-to-room' }
					checked={ clipToRoom ?? false }
					onChange={ (newValue) => {
						layer.modifyDefinition((d) => {
							if (newValue) {
								d.clipToRoom = true;
							} else {
								delete d.clipToRoom;
							}
						});
					} }
				/>
				<label htmlFor={ id + ':clip-to-room' }>
					Clip to room
				</label>
				<ContextHelpButton>
					<p>
						Clips the graphics to the room, at the matching perspective transform depth.
						This is useful mainly for items that want to stop at a wall or ceiling (e.g. a chain going to ceiling), no matter how far the wall is.
					</p>
				</ContextHelpButton>
			</Row>
			<hr />
			<LayerNormalMapSettings layer={ layer } />
			<hr />
			<TabContainer allowWrap>
				<Tab name='Graphical layers'>
					<hr />
					<LayerRoomDeviceAutoSpriteGraphicalLayers layer={ layer } />
				</Tab>
				<Tab name='Variables'>
					<hr />
					<LayerRoomDeviceAutoSpriteVariables layer={ layer } />
				</Tab>
				<Tab name='Images'>
					<hr />
					<LayerRoomDeviceAutoSpriteImages layer={ layer } />
				</Tab>
			</TabContainer>
		</>
	);
}

const SlotPositionOverridesDetail: SettingConditionOverrideTemplateDetails<Immutable<NonNullable<GraphicsSourceRoomDeviceAutoSpriteLayer['offsetOverrides']>[number]>> =
	({ entry, update }) => {
		const id = useId();

		return (
			<div className='layer-size-setup noTitle'>
				<label className='area-xLabel' htmlFor={ id + ':offset-x' }>
					X:
				</label>
				<NumberInput
					id={ id + ':offset-x' }
					value={ entry.offset.x }
					onChange={ (newX) => {
						update(produce(entry, (d) => {
							d.offset.x = newX;
						}));
					} }
					className='area-xInput'
				/>
				<label className='area-yLabel' htmlFor={ id + ':offset-y' }>
					Y:
				</label>
				<NumberInput
					id={ id + ':offset-y' }
					value={ entry.offset.y }
					onChange={ (newY) => {
						update(produce(entry, (d) => {
							d.offset.y = newY;
						}));
					} }
					className='area-yInput'
				/>
			</div>
		);
	};

function LayerRoomDeviceAutoSpriteGraphicalLayers({ layer }: {
	layer: EditorAssetGraphicsRoomDeviceLayer<'autoSprite'>;
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
						<LayerRoomDeviceAutoSpriteGraphicalLayerItem key={ index }
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

function LayerRoomDeviceAutoSpriteGraphicalLayerItem({ graphicalLayer, layer, index, update, remove }: {
	graphicalLayer: Immutable<GraphicsSourceRoomDeviceAutoSpriteGraphicalLayer>;
	layer: EditorAssetGraphicsRoomDeviceLayer<'autoSprite'>;
	index: number;
	update: (producer: (d: Draft<GraphicsSourceRoomDeviceAutoSpriteGraphicalLayer>) => void) => void;
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
			<LayerRoomDeviceAutoSpriteGraphicalLayerItemColorization
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

function LayerRoomDeviceAutoSpriteGraphicalLayerItemColorization({ value, onChange, layer }: {
	value: string;
	onChange: (newValue: string) => void;
	layer: EditorAssetGraphicsRoomDeviceLayer<'autoSprite'>;
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

function LayerRoomDeviceAutoSpriteVariables({ layer }: {
	layer: EditorAssetGraphicsRoomDeviceLayer<'autoSprite'>;
}): ReactElement | null {
	const assetManager = useAssetManager();
	const asset = assetManager.getAssetById(layer.assetGraphics.id);

	const [showAddVariableDialog, setShowAddVariableDialog] = useState(false);

	const { variables } = useObservable(layer.definition);

	const buildContext = useMemo((): GraphicsBuildContext<Immutable<GraphicsBuildContextRoomDeviceData>> | null => {
		if (asset?.isType('roomDevice')) {
			return EditorBuildAssetRoomDeviceGraphicsContext(layer.assetGraphics, asset, assetManager, EditorAssetGraphicsManager);
		}

		if (asset?.isType('personal')) {
			return EditorBuildAssetRoomDeviceGraphicsContextForDeployablePersonalAsset(layer.assetGraphics, asset, assetManager, EditorAssetGraphicsManager);
		}

		return null;
	}, [asset, assetManager, layer.assetGraphics]);

	const addVariable = useCallback((newVariable: GraphicsSourceRoomDeviceAutoSpriteLayerVariable) => {
		if (buildContext == null)
			return;

		const existingVariants: RoomDeviceAutoSpriteLayerGenerateVariableValue[][] = [];

		for (const variable of variables) {
			const values = RoomDeviceAutoSpriteLayerGenerateVariableData(variable, buildContext);
			Assert(values.length > 0, 'Generating variable variants returned empty result');
			existingVariants.push(values);
		}

		const newVariants = RoomDeviceAutoSpriteLayerGenerateVariableData(newVariable, buildContext);
		Assert(newVariants.length > 0, 'Generating variable variants returned empty result');

		layer.modifyDefinition((d) => {
			d.variables.push(newVariable);

			// Update all images
			const newImages: Record<string, string[]> = {};

			for (const combination of (existingVariants.length > 0 ? GenerateMultipleListsFullJoin(existingVariants) : [[GRAPHICS_ROOM_DEVICE_AUTO_SPRITE_LAYER_DEFAULT_VARIANT]])) {
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

		const existingVariants: RoomDeviceAutoSpriteLayerGenerateVariableValue[][] = [];
		const reorderedVariables = variables.toSpliced(startIndex, 1);
		reorderedVariables.splice(startIndex + shift, 0, variables[startIndex]);

		for (const variable of reorderedVariables) {
			const values = RoomDeviceAutoSpriteLayerGenerateVariableData(variable, buildContext);
			Assert(values.length > 0, 'Generating variable variants returned empty result');
			existingVariants.push(values);
		}

		layer.modifyDefinition((d) => {
			d.variables = castDraft(reorderedVariables);

			// Update all images
			const newImages: Record<string, string[]> = {};

			for (const combination of (existingVariants.length > 0 ? GenerateMultipleListsFullJoin(existingVariants) : [[GRAPHICS_ROOM_DEVICE_AUTO_SPRITE_LAYER_DEFAULT_VARIANT]])) {
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

		const existingVariants: RoomDeviceAutoSpriteLayerGenerateVariableValue[][] = [];

		const updatedVariables = variables.toSpliced(startIndex, 1);
		for (const variable of updatedVariables) {
			const values = RoomDeviceAutoSpriteLayerGenerateVariableData(variable, buildContext);
			Assert(values.length > 0, 'Generating variable variants returned empty result');
			existingVariants.push(values);
		}

		layer.modifyDefinition((d) => {
			d.variables = castDraft(updatedVariables);

			// Update all images
			const newImages: Record<string, string[]> = {};

			for (const combination of (existingVariants.length > 0 ? GenerateMultipleListsFullJoin(existingVariants) : [[GRAPHICS_ROOM_DEVICE_AUTO_SPRITE_LAYER_DEFAULT_VARIANT]])) {
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

	const updateVariable = useCallback((index: number, newValue: Immutable<GraphicsSourceRoomDeviceAutoSpriteLayerVariable>) => {
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

	if (asset == null || (!asset.isType('roomDevice') && !asset.isType('personal')) || buildContext == null)
		return null;

	return (
		<Column>
			<Column gap='small'>
				{
					variables.map((v, index) => (
						<LayerRoomDeviceAutoSpriteVariableItem key={ index }
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
					<LayerRoomDeviceAutoSpriteVariableAddDialog
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

function LayerRoomDeviceAutoSpriteVariableItem({ variable, buildContext, index, remove, reorder }: {
	variable: Immutable<GraphicsSourceRoomDeviceAutoSpriteLayerVariable>;
	buildContext: GraphicsBuildContext<Immutable<GraphicsBuildContextRoomDeviceData>>;
	index: number;
	update: (newValue: Immutable<GraphicsSourceRoomDeviceAutoSpriteLayerVariable>) => void;
	remove: (keepId: string) => void;
	reorder: (shift: number) => void;
}): ReactElement {
	const [removeDialog, setRemoveDialog] = useState(false);

	return (
		<Row alignY='center' className='editor-highlightedArea' padding='small'>
			{
				variable.type === 'typedModule' ? (
					<span className='flex-1'>Based on typed module '{ variable.module }'</span>
				) :
				AssertNever(variable as never)
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
							{ RoomDeviceAutoSpriteLayerGenerateVariableData(variable, buildContext).map((variant) => (
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

function LayerRoomDeviceAutoSpriteVariableAddDialog({ close, layer, asset, addVariable }: {
	close: () => void;
	layer: EditorAssetGraphicsRoomDeviceLayer<'autoSprite'>;
	asset: Asset<'personal'> | Asset<'bodypart'> | Asset<'roomDevice'>;
	addVariable: (newVariable: GraphicsSourceRoomDeviceAutoSpriteLayerVariable) => void;
}): ReactElement {
	const assetManager = useAssetManagerEditor();
	const [selectedType, setSelectedType] = useState<GraphicsSourceRoomDeviceAutoSpriteLayerVariable['type'] | null>(null);

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

function LayerRoomDeviceAutoSpriteImages({ layer }: {
	layer: EditorAssetGraphicsRoomDeviceLayer<'autoSprite'>;
}): ReactElement | null {
	const assetManager = useAssetManager();
	const asset = assetManager.getAssetById(layer.assetGraphics.id);
	const id = useId();
	const { variables, graphicalLayers, imageMap } = useObservable(layer.definition);
	const assetTextures = useObservable(layer.assetGraphics.textures);

	const [autofillDialogTarget, setAutofillDialogTarget] = useState<null | true | string>(null);
	const [autofillPrefixes, setAutofillPrefixes] = useState<readonly string[]>([]);

	const buildContext = useMemo((): GraphicsBuildContext<Immutable<GraphicsBuildContextRoomDeviceData>> | null => {
		if (asset?.isType('roomDevice')) {
			return EditorBuildAssetRoomDeviceGraphicsContext(layer.assetGraphics, asset, assetManager, EditorAssetGraphicsManager);
		}

		if (asset?.isType('personal')) {
			return EditorBuildAssetRoomDeviceGraphicsContextForDeployablePersonalAsset(layer.assetGraphics, asset, assetManager, EditorAssetGraphicsManager);
		}

		return null;
	}, [asset, assetManager, layer.assetGraphics]);

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

	if (asset == null || buildContext == null)
		return null;

	const variants: RoomDeviceAutoSpriteLayerGenerateVariableValue[][] = [];

	for (const variable of variables) {
		const values = RoomDeviceAutoSpriteLayerGenerateVariableData(variable, buildContext);
		Assert(values.length > 0, 'Generating variable variants returned empty result');
		variants.push(values);
	}

	const uiVariants: ReactElement[] = [];
	const validCombinationIds = new Set<string>();
	const missingCombinations = new Map<string, string>();

	for (const combination of (variants.length > 0 ? GenerateMultipleListsFullJoin(variants) : [[GRAPHICS_ROOM_DEVICE_AUTO_SPRITE_LAYER_DEFAULT_VARIANT]])) {
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
					<LayerRoomDeviceAutoSpriteFillImagesDialog
						layer={ layer }
						buildContext={ buildContext }
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

function LayerRoomDeviceAutoSpriteFillImagesDialog({ layer, buildContext, close, prefixes, setPrefixes, limitToCombination }: {
	layer: EditorAssetGraphicsRoomDeviceLayer<'autoSprite'>;
	buildContext: GraphicsBuildContext<Immutable<GraphicsBuildContextRoomDeviceData>>;
	close: () => void;
	prefixes: readonly string[];
	setPrefixes: React.Dispatch<React.SetStateAction<readonly string[]>>;
	limitToCombination?: string;
}): ReactElement {
	const [overwriteAll, setOverwriteAll] = useState(false);

	const { variables, graphicalLayers } = useObservable(layer.definition);
	const assetTextures = useObservable(layer.assetGraphics.textures);

	useEffect(() => {
		if (graphicalLayers.length !== prefixes.length) {
			setPrefixes(graphicalLayers.map((l) => snakeCase(l.name)));
		}
	}, [graphicalLayers, prefixes, setPrefixes]);

	const combinations = useMemo(() => {
		const variants: RoomDeviceAutoSpriteLayerGenerateVariableValue[][] = [];

		for (const variable of variables) {
			const values = RoomDeviceAutoSpriteLayerGenerateVariableData(variable, buildContext);
			Assert(values.length > 0, 'Generating variable variants returned empty result');
			variants.push(values);
		}
		return (variants.length > 0 ? Array.from(GenerateMultipleListsFullJoin(variants)) : [[GRAPHICS_ROOM_DEVICE_AUTO_SPRITE_LAYER_DEFAULT_VARIANT]]);
	}, [buildContext, variables]);

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
