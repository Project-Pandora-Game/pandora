import { AssertNever, type ModifierConfigurationEntryDefinition } from 'pandora-common';
import { type ReactElement } from 'react';
import type { Promisable } from 'type-fest';
import { WardrobeCharacterModifierConfigCharacterList } from './characterList';
import { WardrobeCharacterModifierConfigNumber } from './number';
import { WardrobeCharacterModifierConfigString } from './string';
import { WardrobeCharacterModifierConfigStringList } from './stringList';
import './style.scss';
import { WardrobeCharacterModifierConfigToggle } from './toggle';

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
