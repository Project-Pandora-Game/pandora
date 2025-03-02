import { uniq } from 'lodash';
import { CompareCharacterIds, LIMIT_CHARACTER_MODIFIER_CONFIG_CHARACTER_LIST_COUNT, type CharacterId, type ModifierConfigurationEntryDefinition } from 'pandora-common';
import { CharacterModifierBuildConfigurationSchemaSingle } from 'pandora-common/dist/gameLogic/characterModifiers/helpers/configurationBuilder';
import type { ReactElement } from 'react';
import { useMemo } from 'react';
import type { Promisable } from 'type-fest';
import { CharacterListInput } from '../../../../common/characterListInput/characterListInput';
import { FieldsetToggle } from '../../../../common/fieldsetToggle';

export function WardrobeCharacterModifierConfigCharacterList({ definition, value, onChange }: {
	definition: ModifierConfigurationEntryDefinition<'characterList'>;
	value: unknown;
	onChange?: (newValue: readonly CharacterId[]) => Promisable<void>;
}): ReactElement {
	const schema = useMemo(() => CharacterModifierBuildConfigurationSchemaSingle(definition), [definition]);
	const parsedValue = useMemo((): readonly CharacterId[] => uniq(schema.parse(value)).sort(CompareCharacterIds), [schema, value]);

	return (
		<FieldsetToggle legend={ definition.name }>
			<CharacterListInput
				max={ LIMIT_CHARACTER_MODIFIER_CONFIG_CHARACTER_LIST_COUNT }
				value={ parsedValue }
				onChange={ onChange }
			/>
		</FieldsetToggle>
	);
}
