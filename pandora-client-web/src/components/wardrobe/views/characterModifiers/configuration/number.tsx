import { GetLogger, type ModifierConfigurationEntryDefinition, type Promisable } from 'pandora-common';
import { CharacterModifierBuildConfigurationSchemaSingle } from 'pandora-common/dist/gameLogic/characterModifiers/helpers/configurationBuilder.js';
import type { ReactElement } from 'react';
import { useId, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { useAsyncEvent } from '../../../../../common/useEvent';
import { NumberInput } from '../../../../../common/userInteraction/input/numberInput';
import { TOAST_OPTIONS_ERROR } from '../../../../../persistentToast';
import { Button } from '../../../../common/button/button.tsx';
import { Row } from '../../../../common/container/container.tsx';
import { FieldsetToggle } from '../../../../common/fieldsetToggle/index.tsx';

export function WardrobeCharacterModifierConfigNumber({ definition, value, onChange }: {
	definition: ModifierConfigurationEntryDefinition<'number'>;
	value: unknown;
	onChange?: (newValue: number) => Promisable<void>;
}): ReactElement {
	const id = useId();
	const schema = useMemo(() => CharacterModifierBuildConfigurationSchemaSingle(definition), [definition]);

	const parsedValue = useMemo(() => schema.parse(value), [schema, value]);
	const [changedValue, setChangedValue] = useState<number | null>(null);

	const [execute, processing] = useAsyncEvent(async () => {
		if (onChange == null)
			throw new Error('Changing value not supported');
		if (changedValue == null)
			return parsedValue;

		await onChange(changedValue);
		return changedValue;
	}, (result: number) => {
		setChangedValue((currentValue) => (currentValue == null || currentValue === result) ? null : currentValue);
	}, {
		errorHandler: (err) => {
			GetLogger('WardrobeCharacterModifierConfigNumber').error('Failed to configure character modifier:', err);
			toast('Error performing action, try again later', TOAST_OPTIONS_ERROR);
		},
	});

	return (
		<FieldsetToggle legend={ definition.name } className='characterModifierNumberEdit'>
			<Row alignY='center' gap='medium'>
				{
					(definition.options?.withSlider &&
						definition.options.min != null && isFinite(definition.options.min) &&
						definition.options.max != null && isFinite(definition.options.max)
					) ? (
						onChange != null ? (
							<NumberInput
								id={ id + '-slider' }
								aria-label={ definition.name }
								className='flex-6 zero-width'
								rangeSlider
								min={ definition.options.min }
								max={ definition.options.max }
								step={ definition.options?.allowDecimal ? 0.01 : 1 }
								value={ changedValue ?? parsedValue }
								onChange={ (newValue) => {
									setChangedValue(schema.parse(newValue));
								} }
								disabled={ onChange == null || processing }
							/>
						) : (
							<meter
								className='flex-6 monoColor'
								min={ definition.options.min }
								max={ definition.options.max }
								value={ parsedValue }
							>
								{ parsedValue }
							</meter>
						)
					) : null
				}
				{
					onChange != null ? (
						<NumberInput
							id={ id }
							aria-label={ definition.name }
							className='flex-grow-1 value'
							value={ changedValue ?? parsedValue }
							onChange={ (newValue) => {
								setChangedValue(schema.parse(newValue));
							} }
							min={ definition.options?.min }
							max={ definition.options?.max }
							step={ definition.options?.allowDecimal ? undefined : 1 }
							disabled={ onChange == null || processing }
						/>
					) : (
						<strong className='flex-grow-1 value font-tabular'>{ parsedValue }</strong>
					)
				}
				{
					onChange != null ? (
						<Button
							slim
							disabled={ changedValue == null }
							onClick={ execute }
						>
							Save
						</Button>
					) : null
				}
			</Row>
		</FieldsetToggle>
	);
}
