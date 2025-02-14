import type { Immutable } from 'immer';
import { z } from 'zod';
import type { AssetFrameworkGlobalState } from '../../../assets';
import { CharacterIdSchema } from '../../../character/characterTypes';
import { SpaceIdSchema, type CurrentSpaceInfo } from '../../../space';
import { AssertNever } from '../../../utility';
import type { GameLogicCharacter } from '../../character/character';

export const CharacterModifierConditionSchema = z.discriminatedUnion('type', [
	z.object({
		type: z.literal('characterPresent'),
		characterId: CharacterIdSchema,
	}),
	z.object({
		type: z.literal('inSpaceId'),
		/** Id of the space, `null` for personal space. */
		spaceId: SpaceIdSchema.nullable(),
	}),
]);
export type CharacterModifierCondition = z.infer<typeof CharacterModifierConditionSchema>;

export function EvaluateCharacterModifierCondition(
	condition: Immutable<CharacterModifierCondition>,
	gameState: AssetFrameworkGlobalState,
	spaceInfo: Immutable<CurrentSpaceInfo>,
	_character: GameLogicCharacter,
): boolean {

	switch (condition.type) {
		case 'characterPresent':
			return gameState.characters.has(condition.characterId);

		case 'inSpaceId':
			return condition.spaceId === spaceInfo.id;
	}

	AssertNever(condition);
}
