import { Assert, CanonizePointTemplate, GetLogger } from 'pandora-common';
import React, { ReactElement, useCallback, useState } from 'react';
import { toast } from 'react-toastify';
import { AssetGraphicsLayer } from '../../../assets/assetGraphics';
import { useLayerName } from '../../../assets/assetGraphicsCalculations';
import { useAssetManager } from '../../../assets/assetManager';
import { GraphicsManagerInstance } from '../../../assets/graphicsManager';
import { useUpdatedUserInput } from '../../../common/useSyncUserInput';
import { Button } from '../../../components/common/button/button';
import { Row } from '../../../components/common/container/container';
import { Scrollbar } from '../../../components/common/scrollbar/scrollbar';
import { Select } from '../../../components/common/select/select';
import { useNullableObservable, useObservable } from '../../../observable';
import { TOAST_OPTIONS_ERROR, TOAST_OPTIONS_SUCCESS } from '../../../persistentToast';
import { useEditor } from '../../editorContextProvider';
import { DraggablePoint, useDraggablePointDefinition } from '../../graphics/draggable';
import { PointTemplateEditor } from '../../graphics/pointTemplateEditor';
import { ParseTransforms, SerializeTransforms } from '../../parsing';

export function PointsUI(): ReactElement {
	const advancedWarning = <h4 className='error'>This menu is intended for advanced users and is not necessary for the vast majority of assets.</h4>;

	return (
		<Scrollbar color='lighter' className='editor-setupui slim'>
			<h3>Template editing</h3>
			{ advancedWarning }
			<SelectTemplateToEdit />
			<PointsEditUi />
		</Scrollbar>
	);
}

export function LayerName({ layer }: { layer: AssetGraphicsLayer; }): ReactElement {
	return <>{ useLayerName(layer) }</>;
}

export function PointsEditUi(): ReactElement | null {
	const editor = useEditor();
	const getCenter = useObservable(editor.getCenter);
	const selectedTemplate = useObservable(editor.targetTemplate);
	const selectedPoint = useNullableObservable(selectedTemplate?.targetPoint);

	const exportToClipboard = useCallback(() => {
		if (selectedTemplate == null)
			return;

		const result = JSON.stringify(CanonizePointTemplate(selectedTemplate.getCurrent()), undefined, '\t').trim() + '\n';
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
					<PointConfiguration point={ selectedPoint } /> :
					<Row alignY='center'>No point selected</Row>
			}
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
					graphicsManger.pointTemplateList.map((t) => (
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
				<input
					id='x-coord'
					type='number'
					value={ pointX }
					onChange={ (e) => {
						point.setPos(Number.parseInt(e.target.value) || 0, pointY);
					} }
				/>
			</div>
			<div>
				<label htmlFor='y-coord'>Y:</label>
				<input
					id='y-coord'
					type='number'
					value={ pointY }
					onChange={ (e) => {
						point.setPos(pointX, Number.parseInt(e.target.value) || 0);
					} }
				/>
			</div>
			<div>List of transformations for this point:</div>
			<PointTransformationsTextarea point={ point } />
			<div>
				<label>Mirror point to the opposing character half</label>
				<input
					type='checkbox'
					checked={ mirror }
					onChange={ (e) => {
						point.setMirror(e.target.checked);
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
				<input
					id='point-type'
					spellCheck='false'
					value={ pointType ?? '' }
					onChange={ (e) => point.setPointType(e.target.value || undefined) }
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
