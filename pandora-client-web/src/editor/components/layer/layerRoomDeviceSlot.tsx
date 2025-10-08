import { castDraft, produce, type Draft, type Immutable } from 'immer';
import { CloneDeepMutable, EMPTY_ARRAY, type AtomicCondition, type RoomDeviceGraphicsCharacterPosition, type RoomDeviceGraphicsCharacterPositionOverride } from 'pandora-common';
import { ReactElement, useCallback, useId } from 'react';
import { useAssetManager } from '../../../assets/assetManager.tsx';
import { Checkbox } from '../../../common/userInteraction/checkbox.tsx';
import { NumberInput } from '../../../common/userInteraction/input/numberInput.tsx';
import { Select } from '../../../common/userInteraction/select/select.tsx';
import { Column, Row } from '../../../components/common/container/container.tsx';
import { ContextHelpButton } from '../../../components/help/contextHelpButton.tsx';
import { useAppearanceConditionEvaluator } from '../../../graphics/appearanceConditionEvaluator.ts';
import { useObservable } from '../../../observable.ts';
import type { EditorAssetGraphicsRoomDeviceLayer } from '../../assets/editorAssetGraphicsRoomDeviceLayer.ts';
import { useEditorCharacterState } from '../../graphics/character/appearanceEditor.ts';
import { LayerOffsetSettingTemplate, SettingConditionOverrideTemplate, type SettingConditionOverrideTemplateDetails } from './layerCommon.tsx';

export function LayerRoomDeviceSlotUI({ layer }: {
	layer: EditorAssetGraphicsRoomDeviceLayer<'slot'>;
}): ReactElement {
	const id = useId();
	const assetManager = useAssetManager();
	let asset = assetManager.getAssetById(layer.assetGraphics.id);
	if (!asset?.isType('roomDevice'))
		asset = undefined;

	const {
		slot,
		characterPosition,
		characterPositionOverrides,
	} = useObservable(layer.definition);

	const characterState = useEditorCharacterState();
	const evaluator = useAppearanceConditionEvaluator(characterState);
	const wornItem = characterState.items
		.filter((i) => i.isType('roomDeviceWearablePart'))
		.find((i) => i.roomDevice?.asset.id === layer.assetGraphics.id);

	const evaluateCondition = useCallback((c: Immutable<AtomicCondition>) => {
		return evaluator.evalCondition(c, wornItem?.roomDevice ?? null);
	}, [evaluator, wornItem]);

	return (
		<>
			<hr />
			<Row alignY='center'>
				<label htmlFor={ id + ':slot' }>
					Slot:
				</label>
				<Select
					id={ id + ':slot' }
					className='flex-1'
					value={ slot }
					onChange={ (event) => {
						layer.modifyDefinition((d) => {
							d.slot = event.target.value;
						});
					} }
				>
					<option value=''>- Select slot -</option>
					{
						Object.entries(asset?.definition.slots ?? {})
							.map(([k, v]) => (
								<option value={ k } key={ k }>{ v.name }</option>
							))
					}
					{
						(!!slot && asset?.definition.slots[slot] == null) ? (
							<option value={ slot } key={ slot }>[ ERROR: Unknown slot '{ slot }' ]</option>
						) : null
					}
				</Select>
			</Row>
			<hr />
			<SlotPositionUI
				characterPosition={ characterPosition }
				update={ (producer) => {
					layer.modifyDefinition((d) => {
						producer(d.characterPosition);
					});
				} }
			/>
			<h4>Position overrides</h4>
			<SettingConditionOverrideTemplate<Immutable<RoomDeviceGraphicsCharacterPositionOverride>>
				overrides={ characterPositionOverrides ?? EMPTY_ARRAY }
				update={ (newOverrides) => {
					layer.modifyDefinition((d) => {
						if (newOverrides.length > 0) {
							d.characterPositionOverrides = castDraft(newOverrides);
						} else {
							delete d.characterPositionOverrides;
						}
					});
				} }
				EntryDetails={ SlotPositionOverridesDetail }
				getConditions={ (entry) => entry.condition }
				withConditions={ (entry, newConditions) => produce(entry, (d) => {
					d.condition = castDraft(newConditions);
				}) }
				makeNewEntry={ () => ({ position: CloneDeepMutable(characterPosition), condition: [[]] }) }
				conditionEvalutator={ evaluateCondition }
			/>
		</>
	);
}

const SlotPositionOverridesDetail: SettingConditionOverrideTemplateDetails<Immutable<RoomDeviceGraphicsCharacterPositionOverride>> = ({ entry, update }) => (
	<SlotPositionUI
		characterPosition={ entry.position }
		update={ (producer) => {
			update(produce(entry, (d) => {
				producer(d.position);
			}));
		} }
	/>
);

function SlotPositionUI({ characterPosition, update }: {
	characterPosition: Immutable<RoomDeviceGraphicsCharacterPosition>;
	update: (producer: (d: Draft<Immutable<RoomDeviceGraphicsCharacterPosition>>) => void) => void;
}): ReactElement {
	const id = useId();
	const {
		offsetX,
		offsetY,
		pivotOffset,
		relativeScale,
		disablePoseOffset,
	} = characterPosition;

	return (
		<Column>
			<LayerOffsetSettingTemplate
				x={ offsetX }
				y={ offsetY }
				setX={ (newValue) => {
					update((d) => {
						d.offsetX = newValue;
					});
				} }
				setY={ (newValue) => {
					update((d) => {
						d.offsetY = newValue;
					});
				} }
				title={ (
					<>
						<span>
							Layer Offset
						</span>
						<ContextHelpButton>
							<p>
								These two values define how much the current layer is set off in the X- and Y-axis.<br />
								This way you will be able to place an item higher or lower relative to the device's pivot.
							</p>
							<p>
								A positive x-value will move the image to the right, a negative one to the left.<br />
								A positive y-value will move the image to the bottom, a negative one to the top.
							</p>
						</ContextHelpButton>
					</>
				) }
			/>
			<LayerOffsetSettingTemplate
				x={ pivotOffset?.x ?? 0 }
				y={ pivotOffset?.y ?? 0 }
				setX={ (newValue) => {
					update((d) => {
						d.pivotOffset ??= { x: 0, y: 0 };
						d.pivotOffset.x = newValue;
						if (d.pivotOffset.x === 0 && d.pivotOffset.y === 0) {
							delete d.pivotOffset;
						}
					});
				} }
				setY={ (newValue) => {
					update((d) => {
						d.pivotOffset ??= { x: 0, y: 0 };
						d.pivotOffset.y = newValue;
						if (d.pivotOffset.x === 0 && d.pivotOffset.y === 0) {
							delete d.pivotOffset;
						}
					});
				} }
				title={ (
					<>
						<span>
							Character pivot offset
						</span>
						<ContextHelpButton>
							<p>
								These values control offset of character pivot on the character itself (not relative to the device).<br />
								Pivot is a point around which character transformations (such as rotation or scaling) happen.
							</p>
							<p>
								A positive x-value will move the image to the right, a negative one to the left.<br />
								A positive y-value will move the image to the bottom, a negative one to the top.
							</p>
						</ContextHelpButton>
					</>
				) }
			/>
			<Column gap='small'>
				<Row alignY='center'>
					<label htmlFor={ id + ':scale' }>
						Scale
					</label>
					<ContextHelpButton>
						<p>
							This value will scale the character to be smaller or larger, centered on character pivot.<br />
						</p>
						<p>
							This setting is useful when room device has multiple slots and you want to simulate displaying them at different distances from camera.
							If the device only has a single slot or the the characters should be shown at the same depth,
							it is recommended to leave this value at 1 and instead modify rest of the graphics to match the character.
						</p>
					</ContextHelpButton>
				</Row>
				<NumberInput
					id={ id + ':scale' }
					value={ relativeScale ?? 1 }
					min={ 0.0001 }
					step={ 0.0001 }
					onChange={ (newValue) => {
						if (!(newValue > 0))
							return;

						update((d) => {
							if (newValue === 1) {
								delete d.relativeScale;
							} else {
								d.relativeScale = newValue;
							}
						});
					} }
				/>
			</Column>
			<Row alignY='center'>
				<Checkbox
					id={ id + ':disable-offset' }
					checked={ disablePoseOffset ?? false }
					onChange={ (newValue) => {
						update((d) => {
							if (newValue) {
								d.disablePoseOffset = true;
							} else {
								delete d.disablePoseOffset;
							}
						});
					} }
				/>
				<label htmlFor={ id + ':disable-offset' }>
					Disable pose-based offset
				</label>
				<ContextHelpButton>
					<p>
						This setting prevents character's pose from affecting its pivot, offset, or scale while inside this room device slot.
						This is useful for slots where multiple poses (such as standing/kneeling) are allowed, but precision is required
						while positioning the character to allow the graphics to match.
					</p>
				</ContextHelpButton>
			</Row>
		</Column>
	);
}
