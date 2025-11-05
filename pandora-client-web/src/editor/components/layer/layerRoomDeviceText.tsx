import { Immutable } from 'immer';
import type { AssetModuleDefinition, AssetProperties } from 'pandora-common';
import { ReactElement, useId } from 'react';
import { useAssetManager } from '../../../assets/assetManager.tsx';
import { NumberInput } from '../../../common/userInteraction/input/numberInput.tsx';
import { Select } from '../../../common/userInteraction/select/select.tsx';
import { Row } from '../../../components/common/container/container.tsx';
import { ContextHelpButton } from '../../../components/help/contextHelpButton.tsx';
import { useObservable } from '../../../observable.ts';
import type { EditorAssetGraphicsRoomDeviceLayer } from '../../assets/editorAssetGraphicsRoomDeviceLayer.ts';
import { LayerOffsetSettingTemplate } from './layerCommon.tsx';
import { EditorLayerColorPicker, LayerColorizationSetting } from './layerMesh.tsx';

export function LayerRoomDeviceTextUI({ layer }: {
	layer: EditorAssetGraphicsRoomDeviceLayer<'text'>;
}): ReactElement {
	const id = useId();
	const assetManager = useAssetManager();
	const asset = assetManager.getAssetById(layer.assetGraphics.id);

	const {
		dataModule,
		angle,
		fontSize,
	} = useObservable(layer.definition);

	return (
		<>
			<hr />
			<HeightAndWidthSetting layer={ layer } />
			<OffsetSetting layer={ layer } />
			<hr />
			<LayerColorizationSetting layer={ layer } />
			<EditorLayerColorPicker layer={ layer } />
			<hr />
			<Row alignY='center'>
				<label htmlFor={ id + ':data-module' }>
					Text module:
				</label>
				<Select
					id={ id + ':data-module' }
					className='flex-1'
					value={ dataModule }
					onChange={ (event) => {
						layer.modifyDefinition((d) => {
							d.dataModule = event.target.value;
						});
					} }
				>
					<option value=''>- Select text module -</option>
					{
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						Object.entries<Immutable<AssetModuleDefinition<AssetProperties, any>>>(((asset != null && 'modules' in asset.definition) ? (asset.definition.modules) : undefined) ?? {})
							.filter(([,v]) => v.type === 'text')
							.map(([k, v]) => (
								<option value={ k } key={ k }>{ v.name }</option>
							))
					}
					{
						!!dataModule && ((asset != null && 'modules' in asset.definition) ? (asset.definition.modules) : undefined)?.[dataModule] == null ? (
							<option value={ dataModule } key={ dataModule }>[ ERROR: Unknown module '{ dataModule }' ]</option>
						) : null
					}
				</Select>
			</Row>
			<hr />
			<Row alignY='center'>
				<label htmlFor={ id + ':angle' }>
					Angle:
				</label>
				<NumberInput
					id={ id + ':angle' }
					className='flex-1'
					value={ angle ?? 0 }
					onChange={ (newValue) => {
						layer.modifyDefinition((d) => {
							d.angle = newValue;
						});
					} }
					min={ -359 }
					max={ 359 }
					step={ 1 }
				/>
			</Row>
			<Row alignY='center'>
				<label htmlFor={ id + ':font-size' }>
					Font size:
				</label>
				<NumberInput
					id={ id + ':font-size' }
					className='flex-1'
					value={ fontSize }
					onChange={ (newValue) => {
						layer.modifyDefinition((d) => {
							d.fontSize = newValue;
						});
					} }
					min={ 1 }
					step={ 1 }
				/>
			</Row>
		</>
	);
}

function HeightAndWidthSetting({ layer }: { layer: EditorAssetGraphicsRoomDeviceLayer<'text'>; }): ReactElement | null {
	const id = useId();
	const { size } = useObservable(layer.definition);

	return (
		<div className='layer-size-setup'>
			<Row className='area-title' alignY='center'>
				<span>
					Width and Height
				</span>
			</Row>
			<label className='area-xLabel' htmlFor={ id + ':width' }>
				Width:
			</label>
			<NumberInput
				id={ id + ':width' }
				value={ size.width }
				onChange={ (newValue: number) => {
					layer.modifyDefinition((d) => {
						d.size.width = newValue;
					});
				} }
				className='area-xInput'
			/>
			<label className='area-yLabel' htmlFor={ id + ':height' }>
				Height:
			</label>
			<NumberInput
				id={ id + ':height' }
				value={ size.height }
				onChange={ (newValue: number) => {
					layer.modifyDefinition((d) => {
						d.size.height = newValue;
					});
				} }
				className='area-yInput'
			/>
		</div>
	);
}

function OffsetSetting({ layer }: { layer: EditorAssetGraphicsRoomDeviceLayer<'text'>; }): ReactElement | null {
	const {
		offset,
	} = useObservable(layer.definition);

	return (
		<LayerOffsetSettingTemplate
			x={ offset?.x ?? 0 }
			y={ offset?.y ?? 0 }
			setX={ (newValue: number) => {
				layer.modifyDefinition((d) => {
					d.offset ??= { x: 0, y: 0 };
					d.offset.x = newValue;
					if (d.offset.x === 0 && d.offset.y === 0) {
						delete d.offset;
					}
				});
			} }
			setY={ (newValue: number) => {
				layer.modifyDefinition((d) => {
					d.offset ??= { x: 0, y: 0 };
					d.offset.y = newValue;
					if (d.offset.x === 0 && d.offset.y === 0) {
						delete d.offset;
					}
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
	);
}
