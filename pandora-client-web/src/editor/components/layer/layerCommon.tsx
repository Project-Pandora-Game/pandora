import type { Immutable } from 'immer';
import { SortPathStrings, type Condition, type GraphicsSourceLayer } from 'pandora-common';
import { ReactElement, useCallback, useId, useMemo, useState, type ReactNode } from 'react';
import { useAssetManager } from '../../../assets/assetManager.tsx';
import { useEvent } from '../../../common/useEvent.ts';
import { NumberInput } from '../../../common/userInteraction/input/numberInput.tsx';
import { Select } from '../../../common/userInteraction/select/select.tsx';
import { useUpdatedUserInput } from '../../../common/useSyncUserInput.ts';
import { Button } from '../../../components/common/button/button.tsx';
import { Column, Row } from '../../../components/common/container/container.tsx';
import { ContextHelpButton } from '../../../components/help/contextHelpButton.tsx';
import { useObservable } from '../../../observable.ts';
import { type EditorAssetGraphicsWornLayer } from '../../assets/editorAssetGraphicsWornLayer.ts';
import type { EditorAssetGraphicsBase } from '../../assets/graphics/editorAssetGraphicsBase.ts';
import { ParseCondition, SerializeCondition } from '../../parsing.ts';

export function LayerHeightAndWidthSetting({ layer }: { layer: EditorAssetGraphicsWornLayer; }): ReactElement | null {
	const id = useId();
	const { width, height } = useObservable<Immutable<GraphicsSourceLayer>>(layer.definition);

	const onChangeHeight = useEvent((newValue: number) => {
		layer.setHeight(newValue);
	});

	const onChangeWidth = useEvent((newValue: number) => {
		layer.setWidth(newValue);
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
						By default they are have the same value as the character canvas.<br />
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
				className='area-xInput'
			/>
			<label className='area-yLabel' htmlFor={ id + ':height' }>
				Height:
			</label>
			<NumberInput
				id={ id + ':height' }
				value={ height }
				onChange={ onChangeHeight }
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

export function LayerOffsetSetting({ layer }: { layer: EditorAssetGraphicsWornLayer; }): ReactElement | null {
	const {
		x: layerXOffset,
		y: layerYOffset,
	} = useObservable<Immutable<GraphicsSourceLayer>>(layer.definition);

	const onChangeX = useEvent((newValue: number) => {
		layer.setXOffset(newValue);
	});

	const onChangeY = useEvent((newValue: number) => {
		layer.setYOffset(newValue);
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
export function SettingConditionOverrideTemplate<OverrideEntry>({ overrides, update, EntryDetails, getConditions, withConditions, makeNewEntry }: {
	overrides: readonly OverrideEntry[];
	update: (newValue: readonly OverrideEntry[]) => void;
	// eslint-disable-next-line @typescript-eslint/naming-convention
	EntryDetails: SettingConditionOverrideTemplateDetails<OverrideEntry>;
	getConditions: (entry: OverrideEntry) => Immutable<Condition>;
	withConditions: (entry: OverrideEntry, newConditions: Immutable<Condition>) => OverrideEntry;
	makeNewEntry: () => OverrideEntry;
}): ReactElement {
	return (
		<Column className='SettingConditionOverrideTemplate' padding='small'>
			{ overrides.map((entry, i) => (
				<Column key={ i } className='override-entry' padding='small'>
					<Row gap='small'>
						<Column className='flex-1'>
							<EntryDetails entry={ entry } update={ (newValue) => {
								update(overrides.toSpliced(i, 1, newValue));
							} } />
						</Column>
						<Column gap='small'>
							<Button slim onClick={ () => {
								if (i === 0)
									return;
								const newOverrides = overrides.slice();
								newOverrides.splice(i - 1, 0, ...newOverrides.splice(i, 1));
								update(newOverrides);
							} } title='Increase override priority' disabled={ i === 0 }>
								🠉
							</Button>
							<Button slim onClick={ () => {
								update(overrides.toSpliced(i, 1));
							} } title='Remove this override'>
								🗑️
							</Button>
						</Column>
					</Row>
					<ConditionInput
						condition={ getConditions(entry) }
						update={ (newConditions) => {
							update(overrides.toSpliced(i, 1, withConditions(entry, newConditions)));
						} }
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

function ConditionInput({ condition, update }: { condition: Immutable<Condition>; update: (newCondition: Immutable<Condition>) => void; }): ReactElement | null {
	const id = useId();
	const assetManager = useAssetManager();
	const [value, setValue] = useUpdatedUserInput(SerializeCondition(condition));
	const [error, setError] = useState<string | null>(null);

	const onChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setValue(e.target.value);
		try {
			const result = ParseCondition(e.target.value, assetManager.getAllBones().map((b) => b.name));
			setError(null);
			update(result);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		}
	}, [setValue, assetManager, update]);

	return (
		<Column gap='small' className='ConditionInput'>
			<Row alignY='center'>
				<label htmlFor={ `${id}:input` }>Condition:</label>
				<ContextHelpButton>
					<p>
						This field lets you define conditions for when this override should trigger.<br />
						Examples further down. Conditions can be chained with AND ( <code>&amp;</code> ) and OR ( <code>|</code> ) characters.
					</p>
					<p>
						A condition follows the format <code>[name][&lt;|=|&gt;][value]</code>.<br />
						The first value of a condition can either be the name of a bone or of a module defined in<br />
						'*.asset.ts' file of the current asset later on.<br />
						If it is the name of a module you need to prefix it with <code>m_</code> such as <code>m_[modulename]</code>.
					</p>
					<p>
						The value of a bone can be between -180 and 180 (see Pose-tab).<br />
						The value of a module is typically the id of the related variant.
					</p>
					<p>
						You can find the names of all bones in the file <code>/pandora-assets/src/bones.ts</code><br />
						Note that <code>arm_r</code> means only the right arm but there is also <code>arm_l</code> for the left one.
					</p>
					<p>
						Hand rotation and finger positions can also be specified: <br />
						<code>hand_&lt;'rotation' | 'fingers'&gt;_&lt;'left' | 'right'&gt;</code> <br />
						For rotation, the options are: <code>up</code>, <code>down</code>, <code>forward</code>, <code>backward</code>.<br />
						For fingers, the options are: <code>fist</code> and <code>spread</code>.
					</p>
					Some examples:
					<ul>
						<li>
							<code>m_ropeStateModule=harness&amp;breasts&gt;100</code><br />
							This means that if the module with the name <code>ropeStateModule</code> has <code>harness</code> selected<br />
							and the breasts slider is larger than 100, this override will activate.
						</li>
						<li>
							<code>leg_l&lt;0|backView&gt;0</code><br />
							This means that if the left leg slider is in the negative OR the character is in<br />
							the back view, this override will activate.<br />
							<code>backView</code> is a fake bone that has two states: <code>backView&gt;0</code> and <code>backView=0</code>
						</li>
						<li>
							<code>hand_rotation_left=up</code><br />
							This means that if the left hand is rotated up, this override will activate.
						</li>
						<li>
							<code>hand_fingers_right=spread</code><br />
							This means that if the right hand fingers are in a spread position, this override will activate.
						</li>
					</ul>
				</ContextHelpButton>
			</Row>
			<textarea
				id={ `${id}:input` }
				spellCheck='false'
				rows={ 1 }
				value={ value }
				onChange={ onChange }
			/>
			{ error != null && <div className='error'>{ error }</div> }
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
