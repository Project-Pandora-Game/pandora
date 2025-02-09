import type { CharacterModifierCondition } from 'pandora-common';
import type { ReactElement } from 'react';

export function CharacterModifierConditionListEntry({ condition }: {
	condition: CharacterModifierCondition;
	invert: boolean;
}): ReactElement {
	return (
		<>[TODO] { condition.type }</>
	);
}
