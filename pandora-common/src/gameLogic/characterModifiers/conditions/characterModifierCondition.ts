import type { Immutable } from 'immer';
import { z } from 'zod';
import { type AssetDefinitionExtraArgs, type AssetFrameworkGlobalState } from '../../../assets/index.ts';
import { RoomNameSchema } from '../../../assets/appearanceTypes.ts';
import { EffectNameSchema } from '../../../assets/effects.ts';
import { CharacterIdSchema } from '../../../character/characterTypes.ts';
import { LIMIT_ITEM_NAME_LENGTH } from '../../../inputLimits.ts';
import { SpaceIdSchema, SpacePublicSettingSchema, type CurrentSpaceInfo } from '../../../space/index.ts';
import { AssertNever, type Satisfies } from '../../../utility/index.ts';
import type { GameLogicCharacter } from '../../character/character.ts';

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
	z.object({
		type: z.literal('inRoom'),
		/** Name of the room. */
		room: RoomNameSchema,
	}),
	z.object({
		type: z.literal('inSpaceWithVisibility'),
		/** Visibility setting of the space. */
		spaceVisibility: SpacePublicSettingSchema,
	}),
	z.object({
		type: z.literal('hasItemOfAsset'),
		/** Asset Id to match. Wearing room devices also match their parent asset. */
		assetId: z.string(),
	}),
	z.object({
		type: z.literal('hasItemWithAttribute'),
		/** Attribute to look for. */
		attribute: z.string(),
	}),
	z.object({
		type: z.literal('hasItemWithName'),
		/** Custom name to look for (must be exact match, asset names don't count). */
		name: z.string().max(LIMIT_ITEM_NAME_LENGTH),
	}),
	z.object({
		type: z.literal('hasItemWithEffect'),
		/** Effect to detect. Only item effects are checked. */
		effect: EffectNameSchema.nullable(),
		/** Expected minimum strength of the effect, only valid for numeric effects. */
		minStrength: z.number().int().nonnegative().optional(),
	}),
]);
export type CharacterModifierCondition = z.infer<typeof CharacterModifierConditionSchema>;

/** An atomic character modifier condition, but parametrized the same way as asset definitions */
export type CharacterModifierParametrizedCondition<A extends AssetDefinitionExtraArgs = AssetDefinitionExtraArgs> = Satisfies<(
	Extract<CharacterModifierCondition, { type: Exclude<CharacterModifierCondition['type'], 'hasItemWithAttribute'>; }>
	| {
		type: 'hasItemWithAttribute';
		/** Attribute to look for. */
		attribute: A['attributes'];
	}
), CharacterModifierCondition>;

export function EvaluateCharacterModifierCondition(
	condition: Immutable<CharacterModifierCondition>,
	gameState: AssetFrameworkGlobalState,
	spaceInfo: Immutable<CurrentSpaceInfo>,
	character: GameLogicCharacter,
): boolean {

	switch (condition.type) {
		case 'characterPresent':
			return gameState.characters.has(condition.characterId);

		case 'inSpaceId':
			return condition.spaceId === spaceInfo.id;

		case 'inRoom': {
			const characterState = gameState.characters.get(character.id);
			if (characterState == null)
				return false;

			if (!condition.room)
				return false;

			return condition.room === gameState.space.getRoom(characterState.currentRoom)?.name || condition.room === characterState.currentRoom;
		}

		case 'inSpaceWithVisibility':
			return condition.spaceVisibility === spaceInfo.config.public;

		case 'hasItemOfAsset': {
			const characterState = gameState.characters.get(character.id);
			if (characterState == null)
				return false;

			return characterState.items.some((i) => {
				if (i.asset.id === condition.assetId)
					return true;

				if (i.isType('roomDeviceWearablePart') && i.roomDevice?.asset.id === condition.assetId)
					return true;

				return false;
			});
		}

		case 'hasItemWithAttribute': {
			const characterState = gameState.characters.get(character.id);
			if (characterState == null)
				return false;

			return characterState.items.some((i) => i.getProperties().attributes.has(condition.attribute));
		}

		case 'hasItemWithName': {
			const characterState = gameState.characters.get(character.id);
			if (characterState == null)
				return false;

			return characterState.items.some((i) => !!i.name && i.name === condition.name);
		}

		case 'hasItemWithEffect': {
			const characterState = gameState.characters.get(character.id);
			const effectName = condition.effect;
			if (characterState == null || effectName == null)
				return false;

			return characterState.items.some((i) => {
				const effects = i.getProperties().effects;
				const value = effects[effectName];
				if (condition.minStrength != null && (typeof value !== 'number' || value < condition.minStrength))
					return false;

				return !!value;
			});
		}
	}

	AssertNever(condition);
}
