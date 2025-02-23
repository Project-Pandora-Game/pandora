import type { Immutable } from 'immer';
import { AssertNever, type CharacterModifierCondition } from 'pandora-common';
import { type ReactElement } from 'react';
import { ConditionCharacterPresent } from './conditionCharacterPresent';
import { ConditionInSpaceId } from './conditionInSpaceId';

export type CharacterModifierConditionListEntryProps<TCondition extends CharacterModifierCondition['type'] = CharacterModifierCondition['type']> = {
	condition: Immutable<Extract<CharacterModifierCondition, { type: TCondition; }>>;
	setCondition?: (newCondition: Extract<CharacterModifierCondition, { type: TCondition; }>) => void;
	invert: boolean;
	setInvert?: (invert: boolean) => void;
	processing: boolean;
};

export function CharacterModifierConditionListEntry({ condition, ...props }: CharacterModifierConditionListEntryProps): ReactElement {

	switch (condition.type) {
		case 'characterPresent':
			return <ConditionCharacterPresent { ...props } condition={ condition } />;
		case 'inSpaceId':
			return <ConditionInSpaceId { ...props } condition={ condition } />;
	}

	AssertNever(condition);
}
