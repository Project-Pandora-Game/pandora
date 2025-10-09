import { produce, type Immutable } from 'immer';
import { cloneDeep } from 'lodash-es';
import {
	ArmFingersSchema,
	ArmRotationSchema,
	Assert,
	AssertNever,
	AtomicConditionArmRotationSchema,
	AtomicConditionLegsSchema,
	BONE_MAX,
	BONE_MIN,
	CharacterViewSchema,
	ConditionEqOperatorSchema,
	ConditionOperatorSchema,
	type AtomicCondition,
	type Condition,
} from 'pandora-common';
import { ReactElement, useCallback, useId, useMemo, useState, type ReactNode } from 'react';
import * as z from 'zod';
import { useAssetManager } from '../../../assets/assetManager.tsx';
import { NumberInput } from '../../../common/userInteraction/input/numberInput.tsx';
import { TextInput } from '../../../common/userInteraction/input/textInput.tsx';
import { Select } from '../../../common/userInteraction/select/select.tsx';
import { useUpdatedUserInput } from '../../../common/useSyncUserInput.ts';
import { Button } from '../../../components/common/button/button.tsx';
import { Column, Row } from '../../../components/common/container/container.tsx';
import { ContextHelpButton } from '../../../components/help/contextHelpButton.tsx';
import { GetVisibleBoneName } from '../../../components/wardrobe/wardrobeUtils.ts';
import { LogicConditionEditor, type LogicConditionEditorCondition, type LogicConditionEditorConditionComponentProps } from '../../../ui/components/logicConditionEditor/logicConditionEditor.tsx';
import { ParseCondition, SerializeCondition } from '../../parsing.ts';

export function EditorConditionInput({ condition, update, conditionEvalutator }: {
	condition: Immutable<Condition>;
	update: (newCondition: Immutable<Condition>) => void;
	conditionEvalutator?: (condition: Immutable<AtomicCondition>) => boolean | undefined;
}): ReactElement | null {
	const [textMode, setTextMode] = useState(false);

	return (
		<Column gap='small' className='ConditionInput'>
			<Row alignY='center'>
				<Row alignY='center' className='flex-1' gap='tiny'>
					<span>Condition:</span>
					<ContextHelpButton>
						<p>
							This field lets you define conditions for when this override should trigger.<br />
							Examples for text input further down. Conditions can be chained with AND ( <code>&amp;</code> ) and OR ( <code>|</code> ) characters.
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
				<Button
					slim
					theme={ textMode ? 'defaultActive' : 'default' }
					onClick={ () => {
						setTextMode((v) => !v);
					} }
				>
					Text
				</Button>
			</Row>
			{ textMode ? (
				<ConditionInputText
					condition={ condition }
					update={ update }
				/>
			) : (
				<ConditionInputEditor
					condition={ condition }
					update={ update }
					conditionEvalutator={ conditionEvalutator }
				/>
			) }
		</Column>
	);
}

function ConditionInputText({ condition, update }: { condition: Immutable<Condition>; update: (newCondition: Immutable<Condition>) => void; }): ReactElement | null {
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
		<>
			<textarea
				id={ `${id}:input` }
				spellCheck='false'
				rows={ 1 }
				value={ value }
				onChange={ onChange }
			/>
			{ error != null && <div className='error'>{ error }</div> }
		</>
	);
}

function ConditionInputEditor({ condition, update, conditionEvalutator }: {
	condition: Immutable<Condition>;
	update: (newCondition: Immutable<Condition>) => void;
	conditionEvalutator?: (condition: Immutable<AtomicCondition>) => boolean | undefined;
}): ReactElement | null {
	const conditionsChain = useMemo(() => {
		const result: LogicConditionEditorCondition<Immutable<AtomicCondition>>[] = [];

		for (const group of condition) {
			if (group.length === 0) {
				return []; // Any empty group means always active
			}

			for (let i = 0; i < group.length; i++) {
				const c = group[i];
				result.push({
					logic: i === 0 ? 'or' : 'and',
					condition: c,
					active: conditionEvalutator?.(c),
				});
			}
		}

		return result;
	}, [condition, conditionEvalutator]);

	return (
		<Column gap='large'>
			{
				condition.length === 0 ? (
					<i>Never active</i>
				) : conditionsChain.length === 0 ? (
					<i>Always active (no conditions set)</i>
				) : (
					<LogicConditionEditor<Immutable<AtomicCondition>>
						conditions={ conditionsChain }
						onChange={ (newValue) => {
							const result: Immutable<AtomicCondition>[][] = [];
							let pendingGroup: Immutable<AtomicCondition>[] | null = null;

							for (const c of newValue) {
								if (c.logic === 'or' && pendingGroup != null) {
									result.push(pendingGroup);
									pendingGroup = [];
								}
								pendingGroup ??= [];
								pendingGroup.push(c.condition);
							}

							pendingGroup ??= []; // No condition = always active
							result.push(pendingGroup);

							update(result);
						} }
						ConditionComponent={ ConditionInputEntry }
					/>
				)
			}
			<ConditionInputAdd
				addCondition={ ((newCondition) => {
					const newResult = condition.slice();
					if (newResult.length > 0) {
						newResult[newResult.length - 1] = [
							...newResult[newResult.length - 1],
							newCondition,
						];
					} else {
						newResult.push([newCondition]);
					}
					update(newResult);
				}) }
			/>
		</Column>
	);
}

const CONDITION_PRESETS: { name: string; value: Immutable<AtomicCondition>; }[] = [
	{ name: 'Bone', value: { bone: 'character_rotation', operator: '=', value: 0 } },
	{ name: 'Module', value: { module: '', operator: '=', value: '' } },
	{ name: 'Attribute', value: { attribute: '' } },
	{ name: 'Arm Rotation', value: { armType: 'rotation', side: 'left', operator: '=', value: 'up' } },
	{ name: 'Arm Fingers', value: { armType: 'fingers', side: 'left', operator: '=', value: 'spread' } },
	{ name: 'Legs', value: { legs: 'standing' } },
	{ name: 'View', value: { view: 'front' } },
	{ name: 'Blinking', value: { blinking: false } },
];

function ConditionInputAdd({ addCondition }: {
	addCondition: (newCondition: AtomicCondition) => void;
}): ReactElement {
	const [preset, setPreset] = useState<number | null>(null);

	return (
		<Row gap='medium' className='flex-grow-1'>
			<Select
				value={ preset != null ? preset.toString(10) : '' }
				onChange={ (ev) => setPreset(ev.target.value ? Number.parseInt(ev.target.value) : null) }
				className='flex-1'
				disabled={ addCondition == null }
			>
				<option value=''>- Select condition type -</option>
				{ CONDITION_PRESETS.map(({ name }, index) => (
					<option key={ index } value={ index.toString(10) }>
						{ name }
					</option>
				)) }
			</Select>
			<Button
				className='slim'
				onClick={ () => {
					if (preset != null && CONDITION_PRESETS[preset] != null) {
						addCondition(cloneDeep(CONDITION_PRESETS[preset].value));
					}
				} }
				disabled={ preset == null }
			>
				Add
			</Button>
		</Row>
	);
}

function ConditionInputEntry({ condition, setCondition }: LogicConditionEditorConditionComponentProps<Immutable<AtomicCondition>>): ReactNode {
	const assetManager = useAssetManager();

	if ('module' in condition) {
		Assert(condition.module != null);
		return (
			<Row className='flex-1' alignY='center' wrap>
				{ 'Module ' }
				<TextInput
					className='zero-width flex-1'
					value={ condition.module }
					onChange={ (v) => {
						setCondition?.(produce(condition, (d) => {
							d.module = v;
						}));
					} }
				/>
				<EnumSelect
					schema={ ConditionEqOperatorSchema }
					value={ condition.operator }
					onChange={ (v) => {
						setCondition?.(produce(condition, (d) => {
							d.operator = v;
						}));
					} }
				/>
				<TextInput
					className='zero-width flex-1'
					value={ condition.value }
					onChange={ (v) => {
						setCondition?.(produce(condition, (d) => {
							d.value = v;
						}));
					} }
				/>
			</Row>
		);
	} else if ('bone' in condition) {
		Assert(condition.bone != null);
		return (
			<Row className='flex-1' alignY='center' wrap>
				{ 'Bone ' }
				<Select
					value={ condition.bone }
					onChange={ (e) => {
						setCondition?.(produce(condition, (d) => {
							d.bone = e.target.value;
						}));
					} }
					noScrollChange
				>
					{ assetManager.getAllBones().map((b) => (
						<option key={ b.name } value={ b.name }>
							{ GetVisibleBoneName(b.name) }
						</option>
					)) }
				</Select>
				<EnumSelect
					schema={ ConditionOperatorSchema }
					value={ condition.operator }
					onChange={ (v) => {
						setCondition?.(produce(condition, (d) => {
							d.operator = v;
						}));
					} }
				/>
				<NumberInput
					className='flex-1'
					value={ condition.value }
					min={ BONE_MIN }
					max={ BONE_MAX }
					step={ 1 }
					onChange={ (v) => {
						setCondition?.(produce(condition, (d) => {
							d.value = v;
						}));
					} }
				/>
			</Row>
		);
	} else if ('armType' in condition) {
		Assert(condition.armType != null);
		if (condition.armType === 'rotation') {
			return (
				<Row className='flex-1' alignY='center' wrap>
					<EnumSelect
						schema={ AtomicConditionArmRotationSchema.shape.side }
						value={ condition.side }
						onChange={ (v) => {
							setCondition?.(produce(condition, (d) => {
								d.side = v;
							}));
						} }
					/>
					{ ' arm rotation ' }
					<EnumSelect
						schema={ ConditionEqOperatorSchema }
						value={ condition.operator }
						onChange={ (v) => {
							setCondition?.(produce(condition, (d) => {
								d.operator = v;
							}));
						} }
					/>
					<EnumSelect
						schema={ ArmRotationSchema }
						value={ condition.value }
						onChange={ (v) => {
							setCondition?.(produce(condition, (d) => {
								d.value = v;
							}));
						} }
					/>
				</Row>
			);
		} else if (condition.armType === 'fingers') {
			return (
				<Row className='flex-1' alignY='center' wrap>
					<EnumSelect
						schema={ AtomicConditionArmRotationSchema.shape.side }
						value={ condition.side }
						onChange={ (v) => {
							setCondition?.(produce(condition, (d) => {
								d.side = v;
							}));
						} }
					/>
					{ ' arm fingers ' }
					<EnumSelect
						schema={ ConditionEqOperatorSchema }
						value={ condition.operator }
						onChange={ (v) => {
							setCondition?.(produce(condition, (d) => {
								d.operator = v;
							}));
						} }
					/>
					<EnumSelect
						schema={ ArmFingersSchema }
						value={ condition.value }
						onChange={ (v) => {
							setCondition?.(produce(condition, (d) => {
								d.value = v;
							}));
						} }
					/>
				</Row>
			);
		}
		AssertNever(condition);
	} else if ('attribute' in condition) {
		Assert(condition.attribute != null);
		return (
			<Row className='flex-1' alignY='center' wrap>
				<Button
					slim
					onClick={ () => {
						setCondition?.({ attribute: condition.attribute.startsWith('!') ? condition.attribute.slice(1) : ('!' + condition.attribute) });
					} }
				>
					{ condition.attribute.startsWith('!') ? 'Attribute NOT present' : 'Attribute present' }
				</Button>
				<TextInput
					className='flex-1'
					value={ condition.attribute.replace(/^!/, '') }
					onChange={ (v) => {
						setCondition?.({ attribute: (condition.attribute.startsWith('!') ? '!' : '') + v });
					} }
				/>
			</Row>
		);
	} else if ('legs' in condition) {
		Assert(condition.legs != null);
		return (
			<Row className='flex-1' alignY='center' wrap>
				{ 'Legs ' }
				<EnumSelect
					schema={ AtomicConditionLegsSchema.shape.legs }
					value={ condition.legs }
					onChange={ (v) => {
						setCondition?.(produce(condition, (d) => {
							d.legs = v;
						}));
					} }
				/>
			</Row>
		);
	} else if ('view' in condition) {
		Assert(condition.view != null);
		return (
			<Row className='flex-1' alignY='center' wrap>
				{ 'View ' }
				<EnumSelect
					schema={ CharacterViewSchema }
					value={ condition.view }
					onChange={ (v) => {
						setCondition?.(produce(condition, (d) => {
							d.view = v;
						}));
					} }
				/>
			</Row>
		);
	} else if ('blinking' in condition) {
		Assert(condition.blinking != null);
		return (
			<Row className='flex-1' alignY='center' wrap>
				<Button
					slim
					onClick={ () => {
						setCondition?.({ blinking: !condition.blinking });
					} }
				>
					{ condition.blinking ? 'During eye blink' : 'NOT during eye blink' }
				</Button>
			</Row>
		);
	}
	AssertNever(condition);
}

function EnumSelect<T extends z.ZodEnum<z.util.EnumLike>>({ value, onChange, schema }: {
	value: NoInfer<z.infer<T>>;
	onChange: NoInfer<(newValue: z.infer<T>) => void>;
	schema: T;
}): ReactElement {
	return (
		<Select
			value={ value }
			onChange={ (e) => {
				onChange(schema.parse(e.target.value));
			} }
			noScrollChange
		>
			{ schema.options.map((v) => (
				<option key={ v } value={ v }>
					{ v }
				</option>
			)) }
		</Select>
	);
}
