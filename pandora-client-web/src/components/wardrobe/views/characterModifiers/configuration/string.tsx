import { GetLogger, type ModifierConfigurationEntryDefinition, type Promisable } from 'pandora-common';
import { CharacterModifierBuildConfigurationSchemaSingle } from 'pandora-common/dist/gameLogic/characterModifiers/helpers/configurationBuilder.js';
import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { useAsyncEvent } from '../../../../../common/useEvent';
import { TextInput } from '../../../../../common/userInteraction/input/textInput';
import { TOAST_OPTIONS_ERROR } from '../../../../../persistentToast';
import { Button } from '../../../../common/button/button.tsx';
import { Column, Row } from '../../../../common/container/container.tsx';
import { FieldsetToggle } from '../../../../common/fieldsetToggle/index.tsx';
import { FormCreateStringValidator, FormError } from '../../../../common/form/form.tsx';

export function WardrobeCharacterModifierConfigString({ definition, value, onChange }: {
	definition: ModifierConfigurationEntryDefinition<'string'>;
	value: unknown;
	onChange?: (newValue: string) => Promisable<void>;
}): ReactElement {
	const schema = useMemo(() => CharacterModifierBuildConfigurationSchemaSingle(definition), [definition]);

	const parsedValue = useMemo(() => schema.parse(value), [schema, value]);
	const [changedValue, setChangedValue] = useState<string | null>(null);
	const valueError = changedValue != null ? FormCreateStringValidator(schema.unwrap(), 'value')(changedValue) : undefined;

	const [execute, processing] = useAsyncEvent(async () => {
		if (onChange == null)
			throw new Error('Changing value not supported');
		if (changedValue == null || valueError != null)
			return parsedValue;

		await onChange(changedValue);
		return changedValue;
	}, (result: string) => {
		setChangedValue((currentValue) => (currentValue == null || currentValue === result) ? null : currentValue);
	}, {
		errorHandler: (err) => {
			GetLogger('WardrobeCharacterModifierConfigString').error('Failed to configure character modifier:', err);
			toast('Error performing action, try again later', TOAST_OPTIONS_ERROR);
		},
	});

	return (
		<FieldsetToggle legend={ definition.name }>
			<Column>
				<Row>
					<TextInput
						className='flex-1'
						value={ changedValue ?? parsedValue }
						onChange={ setChangedValue }
						maxLength={ definition.options?.maxLength }
						pattern={ definition.options?.match?.toString() }
						disabled={ onChange == null || processing }
					/>
					{
						onChange != null ? (
							<Button
								slim
								disabled={ changedValue == null || valueError != null }
								onClick={ execute }
							>
								Save
							</Button>
						) : null
					}
				</Row>
				{
					valueError ? (
						<FormError error={ valueError } />
					) : null
				}
			</Column>
		</FieldsetToggle>
	);
}
