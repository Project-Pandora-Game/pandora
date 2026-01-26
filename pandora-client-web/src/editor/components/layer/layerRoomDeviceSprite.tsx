import { castDraft, produce, type Immutable } from 'immer';
import { EMPTY_ARRAY, IsNotNullable, type AtomicCondition, type GraphicsSourceRoomDeviceLayerSprite, type LayerImageOverride, type RoomDeviceLayerImageOverride } from 'pandora-common';
import { ReactElement, useCallback, useId, useMemo } from 'react';
import { useAssetManager } from '../../../assets/assetManager.tsx';
import { Checkbox } from '../../../common/userInteraction/checkbox.tsx';
import { NumberInput } from '../../../common/userInteraction/input/numberInput.tsx';
import { Row } from '../../../components/common/container/container.tsx';
import { ContextHelpButton } from '../../../components/help/contextHelpButton.tsx';
import { useStandaloneConditionEvaluator } from '../../../graphics/appearanceConditionEvaluator.ts';
import { useObservable } from '../../../observable.ts';
import type { EditorAssetGraphicsRoomDeviceLayer } from '../../assets/editorAssetGraphicsRoomDeviceLayer.ts';
import { useEditorCharacterState } from '../../graphics/character/appearanceEditor.ts';
import { GetEditorConditionInputMetadataForAsset } from './conditionEditor.tsx';
import { LayerHeightAndWidthSetting, LayerImageSelectInput, LayerOffsetSetting, SettingConditionOverrideTemplate, type SettingConditionOverrideTemplateDetails } from './layerCommon.tsx';
import { EditorLayerColorPicker, LayerColorizationSetting } from './layerMesh.tsx';

export function LayerRoomDeviceSpriteUI({ layer }: {
	layer: EditorAssetGraphicsRoomDeviceLayer<'sprite'>;
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
		image,
		imageOverrides,
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

	const ImageOverridesDetail = useCallback<SettingConditionOverrideTemplateDetails<Immutable<RoomDeviceLayerImageOverride>>>(({ entry, update }) => {
		return (
			<>
				<LayerImageSelectInput
					asset={ layer.assetGraphics }
					value={ entry.image }
					update={ (newValue) => {
						update(produce(entry, (d) => {
							d.image = newValue;
						}));
					} }
				/>
				{ entry.normalMapImage !== undefined ? (
					<span>This entry has Editor-unsupported property <code>normalMapImage</code></span>
				) : null }
			</>
		);
	}, [layer]);

	return (
		<>
			<hr />
			<LayerHeightAndWidthSetting layer={ layer } />
			<LayerOffsetSetting layer={ layer } />
			<h4>Offset overrides</h4>
			<SettingConditionOverrideTemplate<Immutable<NonNullable<GraphicsSourceRoomDeviceLayerSprite['offsetOverrides']>[number]>>
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
			<LayerColorizationSetting layer={ layer } />
			<EditorLayerColorPicker layer={ layer } />
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
			<Row alignY='center'>
				<label htmlFor={ id + ':image' }>
					Layer image:
					<ContextHelpButton>
						<p>
							Select the image you want to be used from the ones you uploaded in the Asset-tab.
						</p>
					</ContextHelpButton>
				</label>
				<LayerImageSelectInput
					id={ id + ':image' }
					className='flex-1'
					asset={ layer.assetGraphics }
					value={ image }
					update={ (newValue) => {
						layer.modifyDefinition((d) => {
							d.image = newValue;
						});
					} }
				/>
			</Row>
			<h4>Image overrides</h4>
			<SettingConditionOverrideTemplate<Immutable<LayerImageOverride>>
				overrides={ imageOverrides ?? EMPTY_ARRAY }
				update={ (newOverrides) => {
					layer.modifyDefinition((d) => {
						if (newOverrides.length > 0) {
							d.imageOverrides = castDraft(newOverrides);
						} else {
							delete d.imageOverrides;
						}
					});
				} }
				EntryDetails={ ImageOverridesDetail }
				getConditions={ (entry) => entry.condition }
				withConditions={ (entry, newConditions) => produce(entry, (d) => {
					d.condition = castDraft(newConditions);
				}) }
				makeNewEntry={ () => ({ image: '', condition: [[]] }) }
				conditionEvalutator={ evaluateCondition }
				conditionsMetadata={ useMemo(() => asset != null ? GetEditorConditionInputMetadataForAsset(asset) : undefined, [asset]) }
			/>
		</>
	);
}

const SlotPositionOverridesDetail: SettingConditionOverrideTemplateDetails<Immutable<NonNullable<GraphicsSourceRoomDeviceLayerSprite['offsetOverrides']>[number]>> =
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
