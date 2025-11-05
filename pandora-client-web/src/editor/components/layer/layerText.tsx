import { Immutable } from 'immer';
import type { AssetModuleDefinition, AssetProperties } from 'pandora-common';
import { ReactElement, useId } from 'react';
import { useAssetManager } from '../../../assets/assetManager.tsx';
import { NumberInput } from '../../../common/userInteraction/input/numberInput.tsx';
import { Select } from '../../../common/userInteraction/select/select.tsx';
import { Row } from '../../../components/common/container/container.tsx';
import { useObservable } from '../../../observable.ts';
import { type EditorAssetGraphicsWornLayer } from '../../assets/editorAssetGraphicsWornLayer.ts';
import { LayerHeightAndWidthSetting, LayerOffsetSetting } from './layerCommon.tsx';
import { EditorLayerColorPicker, EditorLayerPrioritySelect, LayerColorizationSetting } from './layerMesh.tsx';

export function LayerTextUI({ layer }: {
	layer: EditorAssetGraphicsWornLayer<'text'>;
}): ReactElement {
	const id = useId();
	const assetManager = useAssetManager();
	const asset = assetManager.getAssetById(layer.assetGraphics.id);

	const {
		dataModule,
		followBone,
		angle,
		fontSize,
	} = useObservable(layer.definition);

	return (
		<>
			<hr />
			<LayerHeightAndWidthSetting layer={ layer } />
			<LayerOffsetSetting layer={ layer } />
			<hr />
			<LayerColorizationSetting layer={ layer } />
			<EditorLayerColorPicker layer={ layer } />
			<hr />
			<EditorLayerPrioritySelect layer={ layer } />
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
				<label htmlFor={ id + ':follow-bone' }>
					Follow bone movement:
				</label>
				<Select
					id={ id + ':follow-bone' }
					className='flex-1'
					value={ followBone ?? '' }
					onChange={ (event) => {
						layer.modifyDefinition((d) => {
							d.followBone = event.target.value || null;
						});
					} }
				>
					<option value=''>[ None ]</option>
					{
						assetManager.getAllBones()
							.filter((b) => b.x !== 0 && b.y !== 0)
							.map((b) => (
								<option value={ b.name } key={ b.name }>{ b.name }</option>
							))
					}
					{
						followBone != null && !assetManager.getAllBones().some((b) => b.name === followBone) ? (
							<option value={ followBone } key={ followBone }>[ ERROR: Unknown bone '{ followBone }' ]</option>
						) : null
					}
				</Select>
			</Row>
			<Row alignY='center'>
				<label htmlFor={ id + ':angle' }>
					Angle:
				</label>
				<NumberInput
					id={ id + ':angle' }
					className='flex-1'
					value={ angle }
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
