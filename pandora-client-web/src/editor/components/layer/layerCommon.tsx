import type { Immutable } from 'immer';
import { Assert, SortPathStrings, type AtomicCondition, type Condition } from 'pandora-common';
import { ReactElement, useId, useMemo, type ReactNode } from 'react';
import { useEvent } from '../../../common/useEvent.ts';
import { NumberInput } from '../../../common/userInteraction/input/numberInput.tsx';
import { Select } from '../../../common/userInteraction/select/select.tsx';
import { Button } from '../../../components/common/button/button.tsx';
import { Column, Row } from '../../../components/common/container/container.tsx';
import { ContextHelpButton } from '../../../components/help/contextHelpButton.tsx';
import { useObservable } from '../../../observable.ts';
import type { EditorAssetGraphicsRoomDeviceLayer } from '../../assets/editorAssetGraphicsRoomDeviceLayer.ts';
import { type EditorAssetGraphicsWornLayer } from '../../assets/editorAssetGraphicsWornLayer.ts';
import type { EditorAssetGraphicsBase } from '../../assets/graphics/editorAssetGraphicsBase.ts';
import { EditorConditionInput, type EditorConditionInputMetadata } from './conditionEditor.tsx';

export function LayerHeightAndWidthSetting({ layer }: {
	layer: EditorAssetGraphicsWornLayer | EditorAssetGraphicsRoomDeviceLayer<'sprite' | 'autoSprite'>;
}): ReactElement | null {
	const id = useId();
	const { width, height } = useObservable(layer.definition);

	const onChangeHeight = useEvent((newValue: number) => {
		Assert(newValue > 0);
		layer.modifyDefinition((d) => {
			d.height = newValue;
		});
	});

	const onChangeWidth = useEvent((newValue: number) => {
		Assert(newValue > 0);
		layer.modifyDefinition((d) => {
			d.width = newValue;
		});
	});

	return (
		<div className='layer-size-setup'>
			<Row className='area-title' alignY='center'>
				<span>
					Width and Height
				</span>
				<ContextHelpButton>
					<p>
						These two values define width and height of the layer.<br />
						By default they have the same value as the character canvas.<br />
					</p>
				</ContextHelpButton>
			</Row>
			<label className='area-xLabel' htmlFor={ id + ':width' }>
				Width:
			</label>
			<NumberInput
				id={ id + ':width' }
				value={ width }
				onChange={ onChangeWidth }
				min={ 1 }
				className='area-xInput'
			/>
			<label className='area-yLabel' htmlFor={ id + ':height' }>
				Height:
			</label>
			<NumberInput
				id={ id + ':height' }
				value={ height }
				onChange={ onChangeHeight }
				min={ 1 }
				className='area-yInput'
			/>
		</div>
	);
}

export function LayerOffsetSettingTemplate({ x, y, setX, setY, title }: {
	x: number;
	y: number;
	setX: (newValue: number) => void;
	setY: (newValue: number) => void;
	title: ReactNode;
}): ReactElement | null {
	const id = useId();

	return (
		<div className='layer-size-setup'>
			<Row className='area-title' alignY='center'>
				{ title }
			</Row>
			<label className='area-xLabel' htmlFor={ id + ':offset-x' }>
				X:
			</label>
			<NumberInput
				id={ id + ':offset-x' }
				value={ x }
				onChange={ setX }
				className='area-xInput'
			/>
			<label className='area-yLabel' htmlFor={ id + ':offset-y' }>
				Y:
			</label>
			<NumberInput
				id={ id + ':offset-y' }
				value={ y }
				onChange={ setY }
				className='area-yInput'
			/>
		</div>
	);
}

export function LayerOffsetSetting({ layer }: {
	layer: EditorAssetGraphicsWornLayer | EditorAssetGraphicsRoomDeviceLayer<'sprite' | 'autoSprite'>;
}): ReactElement | null {
	const {
		x: layerXOffset,
		y: layerYOffset,
	} = useObservable(layer.definition);

	const onChangeX = useEvent((newValue: number) => {
		layer.modifyDefinition((d) => {
			d.x = newValue;
		});
	});

	const onChangeY = useEvent((newValue: number) => {
		layer.modifyDefinition((d) => {
			d.y = newValue;
		});
	});

	return (
		<LayerOffsetSettingTemplate
			x={ layerXOffset }
			y={ layerYOffset }
			setX={ onChangeX }
			setY={ onChangeY }
			title={ (
				<>
					<span>
						Layer Offset
					</span>
					<ContextHelpButton>
						<p>
							These two values define how much the current layer is set off in the X- and Y-axis.<br />
							This way you will be able to place an item higher or lower on a character.<br />
							Per default, all values are set to 0.
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

export type SettingConditionOverrideTemplateDetails<OverrideEntry> = React.FC<{ entry: OverrideEntry; update: (newValue: OverrideEntry) => void; }>;
export function SettingConditionOverrideTemplate<OverrideEntry>({ overrides, update, EntryDetails, getConditions, withConditions, makeNewEntry, conditionEvalutator, conditionsMetadata }: {
	overrides: readonly OverrideEntry[];
	update: (newValue: readonly OverrideEntry[]) => void;
	// eslint-disable-next-line @typescript-eslint/naming-convention
	EntryDetails: SettingConditionOverrideTemplateDetails<OverrideEntry>;
	getConditions: (entry: OverrideEntry) => Immutable<Condition>;
	withConditions: (entry: OverrideEntry, newConditions: Immutable<Condition>) => OverrideEntry;
	makeNewEntry: () => OverrideEntry;
	conditionEvalutator?: (condition: Immutable<AtomicCondition>) => boolean | undefined;
	conditionsMetadata?: Immutable<EditorConditionInputMetadata>;
}): ReactElement {
	return (
		<Column className='SettingConditionOverrideTemplate' padding='small'>
			{ overrides.map((entry, i) => (
				<Column key={ i } className='override-entry' padding='small'>
					<Row gap='small'>
						<Column className='zero-width flex-1'>
							<EntryDetails entry={ entry } update={ (newValue) => {
								update(overrides.toSpliced(i, 1, newValue));
							} } />
						</Column>
						<Row gap='small' alignY='start'>
							<Button slim onClick={ () => {
								if (i === 0)
									return;
								const newOverrides = overrides.slice();
								newOverrides.splice(i - 1, 0, ...newOverrides.splice(i, 1));
								update(newOverrides);
							} } title='Increase override priority' disabled={ i === 0 }>
								↑
							</Button>
							<Button slim onClick={ () => {
								update(overrides.toSpliced(i, 1));
							} } title='Remove this override'>
								🗑️
							</Button>
						</Row>
					</Row>
					<EditorConditionInput
						condition={ getConditions(entry) }
						update={ (newConditions) => {
							update(overrides.toSpliced(i, 1, withConditions(entry, newConditions)));
						} }
						conditionEvalutator={ conditionEvalutator }
						metadata={ conditionsMetadata }
					/>
				</Column>
			)) }
			<Button
				slim
				onClick={ () => {
					update([
						...overrides,
						makeNewEntry(),
					]);
				} }
			>
				Add override
			</Button>
		</Column>
	);
}

export function LayerImageSelectInput({ asset, value, update, id, className }: {
	asset: EditorAssetGraphicsBase;
	value: string;
	update: (newValue: string) => void;
	id?: string;
	className?: string;
}): ReactElement | null {
	const assetTextures = useObservable(asset.textures);

	const elements = useMemo((): readonly ReactElement[] => [
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

	return (
		<Select
			id={ id }
			className={ className }
			value={ value }
			onChange={ (event) => {
				update(event.target.value);
			} }
		>
			{ elements }
		</Select>
	);
}
