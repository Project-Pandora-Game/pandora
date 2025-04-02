import { Assert, GetLogger } from 'pandora-common';
import React, { ReactElement, useCallback, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { z } from 'zod';
import { useAssetManager } from '../../../assets/assetManager.tsx';
import { GraphicsManagerInstance } from '../../../assets/graphicsManager.ts';
import { useBrowserSessionStorage, useBrowserStorage } from '../../../browserStorage.ts';
import { Checkbox } from '../../../common/userInteraction/checkbox.tsx';
import { NumberInput } from '../../../common/userInteraction/input/numberInput.tsx';
import { TextInput } from '../../../common/userInteraction/input/textInput.tsx';
import { Select } from '../../../common/userInteraction/select/select.tsx';
import { useUpdatedUserInput } from '../../../common/useSyncUserInput.ts';
import { Button } from '../../../components/common/button/button.tsx';
import { Column, Row } from '../../../components/common/container/container.tsx';
import { ContextHelpButton } from '../../../components/help/contextHelpButton.tsx';
import { useAppearanceConditionEvaluator } from '../../../graphics/appearanceConditionEvaluator.ts';
import { useNullableObservable, useObservable } from '../../../observable.ts';
import { TOAST_OPTIONS_ERROR, TOAST_OPTIONS_SUCCESS } from '../../../persistentToast.ts';
import { useEditor } from '../../editorContextProvider.tsx';
import { useEditorCharacterState } from '../../graphics/character/appearanceEditor.ts';
import { DraggablePoint, useDraggablePointDefinition } from '../../graphics/draggable.tsx';
import { PointTemplateEditor } from '../../graphics/pointTemplateEditor.tsx';
import { ParseTransforms, SerializeTransforms } from '../../parsing.ts';

export function PointsUI(): ReactElement {
	const [editingEnabled, setEditingEnabled] = useBrowserStorage('editor.point-edit.enable', false, z.boolean());

	if (!editingEnabled) {
		return (
			<div className='editor-setupui'>
				<h3>Template editing</h3>
				<h4>This menu is intended for advanced users and is not necessary for the vast majority of assets.</h4>
				<h4 className='error'>Editing points without being aware of how assets use them <u>will</u> lead to graphical problems, including breaking existing assets.</h4>
				<Button onClick={ () => setEditingEnabled(true) }>I understand, enable point editing</Button>
			</div>
		);
	}

	return (
		<div className='editor-setupui'>
			<h3>Template editing</h3>
			<SelectTemplateToEdit />
			<PointsEditUi />
			<PointsHelperMathUi />
		</div>
	);
}

export function PointsEditUi(): ReactElement | null {
	const editor = useEditor();
	const getCenter = useObservable(editor.getCenter);
	const selectedTemplate = useObservable(editor.targetTemplate);
	const selectedPoint = useNullableObservable(selectedTemplate?.targetPoint);

	const exportToClipboard = useCallback(() => {
		if (selectedTemplate == null)
			return;

		const result = JSON.stringify(selectedTemplate.getCurrent(), undefined, '\t').trim() + '\n';
		navigator.clipboard.writeText(result)
			.then(() => {
				toast(`Copied to clipboard`, TOAST_OPTIONS_SUCCESS);
			})
			.catch((err) => {
				GetLogger('PointsEditUi').error('Error exporing to clipboard:', err);
				toast(`Error exporting to clipboard:\n${err}`, TOAST_OPTIONS_ERROR);
			});
	}, [selectedTemplate]);

	if (!selectedTemplate)
		return null;

	return (
		<>
			<Button onClick={ exportToClipboard }>Export definition to clipboard</Button>
			<Button onClick={ () => {
				const pos = getCenter();
				selectedTemplate.createNewPoint(pos.x, pos.y);
			} }>
				Add new point
			</Button>
			<h4>POINT CONFIGURATION</h4>
			{
				selectedPoint ?
					<PointConfiguration key={ selectedTemplate.templateName + ':' + selectedPoint.index.toString() } point={ selectedPoint } /> :
					<Row alignY='center'>No point selected</Row>
			}
		</>
	);
}

export function PointsHelperMathUi(): ReactElement | null {
	const editor = useEditor();
	const selectedTemplate = useObservable(editor.targetTemplate);
	const selectedPoint = useNullableObservable(selectedTemplate?.targetPoint);
	const selectedPointDefinition = useNullableObservable(selectedPoint?.definition);

	const characterState = useEditorCharacterState();
	const evaluator = useAppearanceConditionEvaluator(characterState);
	const selectedPointFinal = useMemo((): (readonly [number, number]) | undefined => {
		if (selectedPointDefinition == null)
			return undefined;

		return evaluator.evalTransform(
			selectedPointDefinition.pos,
			selectedPointDefinition.transforms,
			selectedPointDefinition.mirror,
			null,
		);
	}, [selectedPointDefinition, evaluator]);

	const [targetBase, setTargetBase] = useBrowserSessionStorage('editor.point-edit.helper-target.base', [0, 0], z.tuple([z.number(), z.number()]).readonly());
	const [targetOffset, setTargetOffset] = useBrowserSessionStorage('editor.point-edit.helper-target.offset', [0, 0], z.tuple([z.number(), z.number()]).readonly());
	const [adjustmentFactor, setAdjustmentFactor] = useBrowserSessionStorage('editor.point-edit.adjustment-factor', 1, z.number());

	const targetCoords: readonly [number, number] = [
		targetBase[0] + targetOffset[0],
		targetBase[1] + targetOffset[1],
	];

	if (!selectedTemplate)
		return null;

	return (
		<>
			<h4>Helper math <ContextHelpButton>This part of the menu provides additional mathematical tools for more easily making points.</ContextHelpButton></h4>
			{
				(selectedPoint != null && selectedPointDefinition != null && selectedPointFinal != null) ? (
					<Column>
						<table className='with-border'>
							<thead>
								<tr>
									<th></th>
									<th>Value</th>
									<th>Adjusted</th>
								</tr>
							</thead>
							<tbody>
								<tr>
									<td>&#916;X</td>
									<td>{ selectedPointDefinition.pos[0] - targetCoords[0] }</td>
									<td>{ (adjustmentFactor * (selectedPointDefinition.pos[0] - targetCoords[0])).toFixed(2) }</td>
								</tr>
								<tr>
									<td>&#916;Y</td>
									<td>{ selectedPointDefinition.pos[1] - targetCoords[1] }</td>
									<td>{ (adjustmentFactor * (selectedPointDefinition.pos[1] - targetCoords[1])).toFixed(2) }</td>
								</tr>
								<tr>
									<td>Angle</td>
									<td>{ (Math.atan2(selectedPointDefinition.pos[1] - targetCoords[1], selectedPointDefinition.pos[0] - targetCoords[0]) * 180 / Math.PI).toFixed(1) }°</td>
									<td></td>
								</tr>
								<tr>
									<td>[Final] &#916;X</td>
									<td>{ selectedPointFinal[0] - targetCoords[0] }</td>
									<td>{ (adjustmentFactor * (selectedPointFinal[0] - targetCoords[0])).toFixed(2) }</td>
								</tr>
								<tr>
									<td>[Final] &#916;Y</td>
									<td>{ selectedPointFinal[1] - targetCoords[1] }</td>
									<td>{ (adjustmentFactor * (selectedPointFinal[1] - targetCoords[1])).toFixed(2) }</td>
								</tr>
								<tr>
									<td>[Final] Angle</td>
									<td>{ (Math.atan2(selectedPointFinal[1] - targetCoords[1], selectedPointFinal[0] - targetCoords[0]) * 180 / Math.PI).toFixed(1) }°</td>
									<td></td>
								</tr>
							</tbody>
						</table>
						<Row>
							<Button className='flex-1' slim onClick={ () => {
								setTargetBase(selectedPointDefinition.pos);
								setTargetOffset([0, 0]);
							} }>
								Current to target
							</Button>
							<Button className='flex-1' slim onClick={ () => {
								setTargetBase(selectedPointDefinition.pos);
								setTargetOffset([selectedPointFinal[0] - selectedPointDefinition.pos[0], selectedPointFinal[1] - selectedPointDefinition.pos[1]]);
							} }>
								Final to target
							</Button>
						</Row>
					</Column>
				) : null
			}
			<Column alignX='start'>
				<h5>Target</h5>
				<table className='points-helper-input-table'>
					<tr>
						<td>X:</td>
						<td>{ targetCoords[0] } =</td>
						<td>
							<Row alignY='center' className='fill'>
								<NumberInput
									value={ targetBase[0] }
									size={ 5 }
									onChange={ (newValue) => {
										setTargetBase([newValue, targetCoords[1]]);
									} }
								/>
							</Row>
						</td>
						<td>
							<Row alignY='center' className='fill'>
								<span>+</span>
								<NumberInput
									value={ targetOffset[0] }
									size={ 5 }
									onChange={ (newValue) => {
										setTargetOffset([newValue, targetOffset[1]]);
									} }
								/>
							</Row>
						</td>
					</tr>
					<tr>
						<td>Y:</td>
						<td>{ targetCoords[1] } =</td>
						<td>
							<Row alignY='center' className='fill'>
								<NumberInput
									value={ targetBase[1] }
									size={ 5 }
									onChange={ (newValue) => {
										setTargetBase([targetCoords[0], newValue]);
									} }
								/>
							</Row>
						</td>
						<td>
							<Row alignY='center' className='fill'>
								<span>+</span>
								<NumberInput
									value={ targetOffset[1] }
									size={ 5 }
									onChange={ (newValue) => {
										setTargetOffset([targetOffset[0], newValue]);
									} }
								/>
							</Row>
						</td>
					</tr>
				</table>
				<Row alignY='center'>
					<label>Adjustment</label>
					<NumberInput
						value={ adjustmentFactor }
						onChange={ setAdjustmentFactor }
					/>
				</Row>
			</Column>
		</>
	);
}

function SelectTemplateToEdit(): ReactElement | null {
	const editor = useEditor();
	const selectedTemplate = useObservable(editor.targetTemplate);
	const graphicsManger = useObservable(GraphicsManagerInstance);

	if (!graphicsManger)
		return null;

	return (
		<Row alignY='center'>
			<label htmlFor='template-edit-select'>Select template to edit:</label>
			<Select
				id='template-edit-select'
				className='flex-1'
				value={ selectedTemplate != null ? `t/${selectedTemplate.templateName}` : '' }
				onChange={ (event) => {
					if (!event.target.value) {
						editor.targetTemplate.value = null;
					} else {
						Assert(event.target.value.startsWith('t/'));
						editor.targetTemplate.value = new PointTemplateEditor(event.target.value.substring(2), editor);
					}
				} }
			>
				<option value='' key=''>[ None ]</option>
				{
					Array.from(graphicsManger.pointTemplates.keys()).map((t) => (
						<option value={ `t/${t}` } key={ `t/${t}` }>{ t }</option>
					))
				}
			</Select>
		</Row>
	);
}

function PointConfiguration({ point }: { point: DraggablePoint; }): ReactElement | null {
	const { pos, mirror, pointType } = useDraggablePointDefinition(point);
	const pointX = pos[0];
	const pointY = pos[1];

	return (
		<>
			<div>
				<label htmlFor='x-coord'>X:</label>
				<NumberInput
					id='x-coord'
					value={ pointX }
					onChange={ (newValue) => {
						point.setPos(newValue, pointY);
					} }
				/>
			</div>
			<div>
				<label htmlFor='y-coord'>Y:</label>
				<NumberInput
					id='y-coord'
					value={ pointY }
					onChange={ (newValue) => {
						point.setPos(pointX, newValue);
					} }
				/>
			</div>
			<div>List of transformations for this point:</div>
			<PointTransformationsTextarea point={ point } />
			<div>
				<label>Mirror point to the opposing character half</label>
				<Checkbox
					checked={ mirror }
					onChange={ (newValue) => {
						point.setMirror(newValue);
					} }
				/>
			</div>
			<Row>
				<Button slim onClick={ () => {
					point.mirrorSwap();
				} }>
					Swap point and mirror
				</Button>
			</Row>
			<div>
				<label htmlFor='point-type'>Point type:</label>
				<TextInput
					id='point-type'
					spellCheck='false'
					value={ pointType ?? '' }
					onChange={ (newValue) => point.setPointType(newValue) }
				/>
			</div>
			<Button
				onClick={ () => {
					point.deletePoint();
				} }>
				Delete this point
			</Button>
		</>
	);
}

function PointTransformationsTextarea({ point }: { point: DraggablePoint; }): ReactElement | null {
	const assetManager = useAssetManager();
	const [value, setValue] = useUpdatedUserInput(SerializeTransforms(useDraggablePointDefinition(point).transforms), [point]);
	const [error, setError] = useState<string | null>(null);

	const onChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setValue(e.target.value);
		try {
			const result = ParseTransforms(e.target.value, assetManager.getAllBones().map((b) => b.name));
			setError(null);
			point.setTransforms(result);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		}
	}, [point, setValue, assetManager]);

	return (
		<>
			<textarea
				spellCheck='false'
				rows={ 6 }
				value={ value }
				onChange={ onChange }
			/>
			{ error != null && <div className='error'>{ error }</div> }
		</>
	);
}
