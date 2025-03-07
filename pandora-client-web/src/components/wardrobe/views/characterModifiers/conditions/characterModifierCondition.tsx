import type { Immutable } from 'immer';
import { AssertNever, type CharacterModifierCondition } from 'pandora-common';
import { type ReactElement } from 'react';
import type { ICharacter } from '../../../../../character/character';
import { ConditionCharacterPresent } from './conditionCharacterPresent';
import { ConditionInSpaceId } from './conditionInSpaceId';
import { ConditionItemOfAsset } from './conditionItemOfAsset';
import { ConditionItemWithAttribute } from './conditionItemWithAttribute';
import { ConditionItemWithEffect } from './conditionItemWithEffect';
import { ConditionItemWithName } from './conditionItemWithName';

export type CharacterModifierConditionListEntryProps<TCondition extends CharacterModifierCondition['type'] = CharacterModifierCondition['type']> = {
	condition: Immutable<Extract<CharacterModifierCondition, { type: TCondition; }>>;
	setCondition?: (newCondition: Extract<CharacterModifierCondition, { type: TCondition; }>) => void;
	invert: boolean;
	setInvert?: (invert: boolean) => void;
	processing: boolean;
	character: ICharacter;
};

export function CharacterModifierConditionListEntry({ condition, ...props }: CharacterModifierConditionListEntryProps): ReactElement {

	switch (condition.type) {
		case 'characterPresent':
			return <ConditionCharacterPresent { ...props } condition={ condition } />;
		case 'inSpaceId':
			return <ConditionInSpaceId { ...props } condition={ condition } />;
		case 'hasItemOfAsset':
			return <ConditionItemOfAsset { ...props } condition={ condition } />;
		case 'hasItemWithAttribute':
			return <ConditionItemWithAttribute { ...props } condition={ condition } />;
		case 'hasItemWithName':
			return <ConditionItemWithName { ...props } condition={ condition } />;
		case 'hasItemWithEffect':
			return <ConditionItemWithEffect { ...props } condition={ condition } />;
	}

	AssertNever(condition);
}
