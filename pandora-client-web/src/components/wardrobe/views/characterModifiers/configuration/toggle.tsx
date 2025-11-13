import { GetLogger, type ModifierConfigurationEntryDefinition, type Promisable } from 'pandora-common';
import { CharacterModifierBuildConfigurationSchemaSingle } from 'pandora-common/gameLogic/characterModifiers/helpers/configurationBuilder';
import type { ReactElement } from 'react';
import { useId, useMemo } from 'react';
import { toast } from 'react-toastify';
import { useAsyncEvent } from '../../../../../common/useEvent';
import { Checkbox } from '../../../../../common/userInteraction/checkbox';
import { TOAST_OPTIONS_ERROR } from '../../../../../persistentToast';
import { Row } from '../../../../common/container/container.tsx';

export function WardrobeCharacterModifierConfigToggle({ definition, value, onChange }: {
	definition: ModifierConfigurationEntryDefinition<'toggle'>;
	value: unknown;
	onChange?: (newValue: boolean) => Promisable<void>;
}): ReactElement {
	const id = useId();
	const schema = useMemo(() => CharacterModifierBuildConfigurationSchemaSingle(definition), [definition]);

	const parsedValue = useMemo(() => schema.parse(value), [schema, value]);

	const [execute, processing] = useAsyncEvent(async (newValue: boolean) => {
		if (onChange == null)
			throw new Error('Changing value not supported');

		await onChange(newValue);
	}, null, {
		errorHandler: (err) => {
			GetLogger('WardrobeCharacterModifierConfigToggle').error('Failed to configure character modifier:', err);
			toast('Error performing action, try again later', TOAST_OPTIONS_ERROR);
		},
	});

	return (
		<Row padding='medium'>
			<Checkbox
				id={ id }
				checked={ parsedValue }
				onChange={ execute }
				disabled={ onChange == null || processing }
			/>
			<label htmlFor={ id }>
				{ definition.name }
			</label>
		</Row>
	);
}
