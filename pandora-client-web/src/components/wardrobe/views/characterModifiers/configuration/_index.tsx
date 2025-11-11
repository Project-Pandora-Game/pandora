import { AssertNever, type ModifierConfigurationEntryDefinition, type Promisable } from 'pandora-common';
import { type ReactElement } from 'react';
import { WardrobeCharacterModifierConfigCharacterList } from './characterList.tsx';
import { WardrobeCharacterModifierConfigNumber } from './number.tsx';
import { WardrobeCharacterModifierConfigString } from './string.tsx';
import { WardrobeCharacterModifierConfigStringList } from './stringList.tsx';
import './style.scss';
import { WardrobeCharacterModifierConfigToggle } from './toggle.tsx';

export function WardrobeCharacterModifierConfig({ definition, ...props }: {
	definition: ModifierConfigurationEntryDefinition;
	value: unknown;
	onChange?: (newValue: unknown) => Promisable<void>;
}): ReactElement {
	switch (definition.type) {
		case 'string':
			return <WardrobeCharacterModifierConfigString definition={ definition } { ...props } />;
		case 'stringList':
			return <WardrobeCharacterModifierConfigStringList definition={ definition } { ...props } />;
		case 'number':
			return <WardrobeCharacterModifierConfigNumber definition={ definition } { ...props } />;
		case 'characterList':
			return <WardrobeCharacterModifierConfigCharacterList definition={ definition } { ...props } />;
		case 'toggle':
			return <WardrobeCharacterModifierConfigToggle definition={ definition } { ...props } />;
	}

	AssertNever(definition);
}
