import { EFFECT_NAMES, EffectNameSchema, EFFECTS_DEFAULT, KnownObject, type EffectName } from 'pandora-common';
import { useState, type ReactElement } from 'react';
import { NumberInput } from '../../../../../common/userInteraction/input/numberInput';
import { Select } from '../../../../../common/userInteraction/select/select';
import { Button } from '../../../../common/button/button.tsx';
import { Column, Row } from '../../../../common/container/container.tsx';
import { ModalDialog } from '../../../../dialog/dialog.tsx';
import type { CharacterModifierConditionListEntryProps } from './characterModifierCondition.tsx';

export function ConditionItemWithEffect({ condition, setCondition, invert, setInvert, processing }: CharacterModifierConditionListEntryProps<'hasItemWithEffect'>): ReactElement {
	const [showDialog, setShowDialog] = useState(false);

	return (
		<span>
			<Button
				onClick={ () => setInvert?.(!invert) }
				disabled={ processing || setInvert == null }
				slim
			>
				{ invert ? 'Is not' : 'Is' }
			</Button>
			{ ' wearing an item with ' }
			<Button
				onClick={ () => setShowDialog(true) }
				slim
				disabled={ setCondition == null }
			>
				{ condition.effect != null ? EFFECT_NAMES[condition.effect] : '[not set]' }
				{ condition.minStrength != null ? ` ≥ ${condition.minStrength}` : '' }
			</Button>
			{ ' effect' }
			{ showDialog ? (
				<ConditionItemWithEffectDialog condition={ condition } setCondition={ setCondition } close={ () => setShowDialog(false) } />
			) : null }
		</span>
	);
}

function ConditionItemWithEffectDialog({ condition, setCondition, close }: Pick<CharacterModifierConditionListEntryProps<'hasItemWithEffect'>, 'condition' | 'setCondition'> & { close: () => void; }): ReactElement {
	const [effect, setEffect] = useState<EffectName | null | undefined>(undefined);
	const [minimumStrength, setMinimumStrength] = useState<number | null>(null);

	const effectiveEffect = effect !== undefined ? effect : condition.effect;
	const hasStrength = effectiveEffect != null && typeof EFFECTS_DEFAULT[effectiveEffect] === 'number';
	const effectiveMinimumStrength = hasStrength ? (minimumStrength ?? condition.minStrength ?? 1) : null;

	return (
		<ModalDialog>
			<Column>
				<h2>Select effect</h2>
				<Row alignY='center'>
					<label>Effect:</label>
					<Select
						className='flex-1'
						value={ effectiveEffect ?? '' }
						onChange={ (ev) => {
							const value = ev.target.value;
							setEffect(!value ? null : EffectNameSchema.parse(value));
						} }
					>
						<option value=''>- Select an effect -</option>
						{
							KnownObject.entries(EFFECT_NAMES).map(([e, name]) => (
								<option key={ e } value={ e }>{ name }</option>
							))
						}
					</Select>
				</Row>
				{
					effectiveMinimumStrength != null ? (
						<Row alignY='center'>
							<label>Minimum strength:</label>
							<NumberInput
								value={ effectiveMinimumStrength }
								onChange={ setMinimumStrength }
								min={ 0 }
							/>
						</Row>
					) : null
				}
				<Row alignX='space-between'>
					<Button
						onClick={ () => {
							close();
						} }
					>
						Cancel
					</Button>
					<Button
						onClick={ () => {
							if (effect !== undefined || minimumStrength != null) {
								setCondition?.({
									type: 'hasItemWithEffect',
									effect: effectiveEffect,
									minStrength: effectiveMinimumStrength ?? undefined,
								});
							}
							close();
						} }
						disabled={ setCondition == null }
					>
						Confirm
					</Button>
				</Row>
			</Column>
		</ModalDialog>
	);
}
