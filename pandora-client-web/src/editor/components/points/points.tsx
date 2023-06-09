import React, { ReactElement, useCallback, useState } from 'react';
import { AssetGraphicsLayer, LayerToImmediateName, useLayerDefinition, useLayerName } from '../../../assets/assetGraphics';
import { useAssetManager } from '../../../assets/assetManager';
import { GraphicsManagerInstance } from '../../../assets/graphicsManager';
import { useUpdatedUserInput } from '../../../common/useSyncUserInput';
import { Button } from '../../../components/common/button/button';
import { Select } from '../../../components/common/select/select';
import { Scrollbar } from '../../../components/common/scrollbar/scrollbar';
import { StripAssetIdPrefix } from '../../../graphics/utility';
import { useObservable } from '../../../observable';
import { useEditorAssetLayers } from '../../editor';
import { useEditor } from '../../editorContextProvider';
import { EditorAssetGraphics } from '../../graphics/character/appearanceEditor';
import { DraggablePoint, useDraggablePointDefinition } from '../../graphics/draggable';
import { ParseTransforms, SerializeTransforms } from '../../parsing';
import { Row } from '../../../components/common/container/container';

export function PointsUI(): ReactElement {
	const editor = useEditor();
	const selectedLayer = useObservable(editor.targetLayer);
	const asset = selectedLayer?.asset;

	const advancedWarning = <h3 className='error'>This menu is intended for advanced users and is not necessary for the vast majority of assets.</h3>;

	if (!selectedLayer || !asset || !(asset instanceof EditorAssetGraphics)) {
		return (
			<div className='editor-setupui'>
				{ advancedWarning }
				<h3>Select an layer to edit its points</h3>
			</div>
		);
	}

	return (
		<Scrollbar color='lighter' className='editor-setupui slim'>
			{ advancedWarning }
			<h3>Editing: { StripAssetIdPrefix(selectedLayer.asset.id) } &gt; <LayerName layer={ selectedLayer } /></h3>
			<MirrorPointsFromLayer layer={ selectedLayer } asset={ asset } />
			<PointsEditUi layer={ selectedLayer } />
		</Scrollbar>
	);
}

export function LayerName({ layer }: { layer: AssetGraphicsLayer; }): ReactElement {
	return <>{ useLayerName(layer) }</>;
}

export function PointsEditUi({ layer }: { layer: AssetGraphicsLayer; }): ReactElement {
	const editor = useEditor();
	const getCenter = useObservable(editor.getCenter);
	const selectedPoint = useObservable(editor.targetPoint);
	const { points } = useLayerDefinition(layer);

	if (typeof points === 'string') {
		return <div>Template cannot be edited</div>;
	}

	return (
		<>
			<Button onClick={ () => {
				const pos = getCenter();
				layer.createNewPoint(pos.x, pos.y);
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

function MirrorPointsFromLayer({ layer, asset }: { layer: AssetGraphicsLayer; asset: EditorAssetGraphics; }): ReactElement | null {
	const layers = useEditorAssetLayers(asset, false);
	const { points } = useLayerDefinition(layer);
	const graphicsManger = useObservable(GraphicsManagerInstance);
	const pointSourceLayer = typeof points === 'number' ? asset.layers[points] : layer;
	const pointSourceLayerName = useLayerName(pointSourceLayer);

	if (!graphicsManger)
		return null;

	const elements: ReactElement[] = [<option value='' key=''>[ None ]</option>];
	for (const l of layers) {
		if (Array.isArray(l.definition.value.points) && l !== layer) {
			elements.push(
				<option value={ l.index } key={ l.index }>{ LayerToImmediateName(l) }</option>,
			);
		}
	}
	// Add point template options
	for (const t of graphicsManger.pointTemplateList) {
		const id = `t/${t}`;
		elements.push(
			<option value={ id } key={ id }>Template: { t }</option>,
		);
	}
	return (
		<>
			<Row alignY='center'>
				<label htmlFor='mirror-points-from-layer'>Mirror all points from selected layer:</label>
				<br />
				<Select
					id='mirror-points-from-layer'
					value={ typeof points === 'number' ? `${points}` : typeof points === 'string' ? `t/${points}` : '' }
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
					{ elements }
				</Select>
			</Row>
			{
				typeof points === 'number' &&
				<>
					<Row alignY='center'>Points are mirrored from layer: { pointSourceLayerName }</Row>
					<Button onClick={ () => {
						asset.layerMirrorFrom(layer, null);
					} }>
						Unlink mirrored points
					</Button>
				</>
			}
			{
				typeof points === 'string' &&
				<>
					<Row alignY='center'>Points are from template: { points }</Row>
					<Button onClick={ () => {
						asset.layerMirrorFrom(layer, null);
					} }>
						Unlink point template
					</Button>
				</>
			}
		</>
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
