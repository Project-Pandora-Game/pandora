import type { Immutable } from 'immer';
import * as z from 'zod';
import type { AssetDefinitionExtraArgs, AssetFrameworkGlobalState } from '../../../assets/index.ts';
import { LIMIT_CHARACTER_MODIFIER_CONFIG_CONDITION_COUNT } from '../../../inputLimits.ts';
import type { CurrentSpaceInfo } from '../../../space/index.ts';
import type { Satisfies } from '../../../utility/index.ts';
import type { GameLogicCharacter } from '../../character/character.ts';
import { CharacterModifierConditionSchema, EvaluateCharacterModifierCondition, type CharacterModifierParametrizedCondition } from './characterModifierCondition.ts';

/** A single record in condition chain. */
export const CharacterModifierConditionRecordSchema = z.object({
	/** The base condition of this record. */
	condition: CharacterModifierConditionSchema,
	/**
	 * The way this condition combines with _previous_ ones.
	 * Follows Disjunctive normal form operator precedence.
	 * Ignored for the first condition (first condition can be assumed to be 'or').
	 */
	logic: z.enum(['and', 'or']),
	/** Whether the result of evaluating `condition` should be inverted. */
	invert: z.boolean(),
});
export type CharacterModifierConditionRecord = z.infer<typeof CharacterModifierConditionRecordSchema>;

export type CharacterModifierParametrizedConditionRecord<A extends AssetDefinitionExtraArgs = AssetDefinitionExtraArgs> = Satisfies<
	Omit<CharacterModifierConditionRecord, 'condition'> & {
		condition: CharacterModifierParametrizedCondition<A>;
	}, CharacterModifierConditionRecord>;

export const CharacterModifierConditionChainSchema = CharacterModifierConditionRecordSchema.array()
	.max(LIMIT_CHARACTER_MODIFIER_CONFIG_CONDITION_COUNT);
export type CharacterModifierConditionChain = z.infer<typeof CharacterModifierConditionChainSchema>;

export type CharacterModifierParametrizedConditionChain<A extends AssetDefinitionExtraArgs = AssetDefinitionExtraArgs> = Satisfies<CharacterModifierParametrizedConditionRecord<A>[], CharacterModifierConditionChain>;

export function EvaluateCharacterModifierConditionChain(
	chain: Immutable<CharacterModifierConditionChain>,
	gameState: AssetFrameworkGlobalState,
	spaceInfo: Immutable<CurrentSpaceInfo>,
	character: GameLogicCharacter,
): boolean {
	// Empty chain is always truthy (for always false, user can just disable the modifier)
	if (chain.length === 0)
		return true;

	let groupValid = chain[0].logic === 'and'; // First element should always start a new group. Fake a (so far) valid group if it doesn't.

	for (const conditionRecord of chain) {
		// If this condition starts a new group
		if (conditionRecord.logic === 'or') {
			// If previous group was valid, success.
			if (groupValid)
				return true;
			// Otherwise start a new group
			groupValid = true;
		}

		// Evaluate this condition
		let conditionResult = EvaluateCharacterModifierCondition(conditionRecord.condition, gameState, spaceInfo, character);
		// Invert if needed
		if (conditionRecord.invert) {
			conditionResult = !conditionResult;
		}

		// If condition failed, break this group
		if (!conditionResult) {
			groupValid = false;
		}
	}

	// At the end return result of the last group
	return groupValid;
}
