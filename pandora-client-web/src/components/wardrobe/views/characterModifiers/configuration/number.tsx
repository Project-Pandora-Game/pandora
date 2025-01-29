import { GetLogger, type ModifierConfigurationEntryDefinition } from 'pandora-common';
import { CharacterModifierBuildConfigurationSchemaSingle } from 'pandora-common/dist/gameLogic/characterModifiers/helpers/configurationBuilder';
import type { ReactElement } from 'react';
import React, { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import type { Promisable } from 'type-fest';
import { useAsyncEvent } from '../../../../../common/useEvent';
import { NumberInput } from '../../../../../common/userInteraction/input/numberInput';
import { TOAST_OPTIONS_ERROR } from '../../../../../persistentToast';
import { Button } from '../../../../common/button/button';
import { Row } from '../../../../common/container/container';
import { FieldsetToggle } from '../../../../common/fieldsetToggle';

export function WardrobeCharacterModifierConfigNumber({ definition, value, onChange }: {
	definition: ModifierConfigurationEntryDefinition<'number'>;
	value: unknown;
	onChange?: (newValue: number) => Promisable<void>;
}): ReactElement {
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
		<FieldsetToggle legend={ definition.name }>
			<Row>
				<NumberInput
					className='flex-1'
					value={ changedValue ?? parsedValue }
					onChange={ (newValue) => {
						setChangedValue(schema.parse(newValue));
					} }
					min={ definition.options?.min }
					max={ definition.options?.max }
					step={ definition.options?.allowDecimal ? undefined : 1 }
					disabled={ onChange == null || processing }
				/>
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
