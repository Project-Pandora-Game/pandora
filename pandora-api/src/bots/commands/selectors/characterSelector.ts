import { AssertNotNullable, CharacterIdSchema, type AssetFrameworkCharacterState, type CommandStepProcessor } from 'pandora-common';
import type { BotSpaceCharacter } from '../../state/botSpaceCharacter.ts';
import type { BotCommandRepositoryCommandContext } from '../commandRepository.ts';

export type CommandSelectorCharacterSelfSelect = 'none' | 'otherCharacter' | 'any';

/**
 * Allows the user to select any character from the current space.
 */
export const CommandSelectorCharacter = ({ allowSelf, filter }: {
	/** Whether the  */
	allowSelf: CommandSelectorCharacterSelfSelect;
	filter?: (character: { character: BotSpaceCharacter; characterState: AssetFrameworkCharacterState; }) => boolean;
}): CommandStepProcessor<BotSpaceCharacter, Pick<BotCommandRepositoryCommandContext, 'gameState' | 'character'>> => ({
	preparse: 'quotedArgTrimmed',
	parse(selector, { gameState, character: playerCharacter }) {
		const parsedId = CharacterIdSchema.safeParse(selector);
		// Client pre-parsing always returns an id
		if (!parsedId.success) {
			return {
				success: false,
				error: `'${selector}' is not a valid Character ID (this is a bug in Pandora)`,
			};
		}
		const id = parsedId.data;

		const characters = gameState.characters.filter((character) => {
			return gameState.globalState.getCharacterState(character.id) != null;
		});

		const target = characters.find((c) => c.data.id === id);
		if (!target) {
			return {
				success: false,
				error: `Character #${id} not found in the room.`,
			};
		}
		const characterState = gameState.globalState.getCharacterState(target.id);
		AssertNotNullable(characterState); // Checked by earlier filter
		if (allowSelf !== 'any' && target.id === playerCharacter.id) {
			return {
				success: false,
				error: `This command doesn't allow targeting yourself.`,
			};
		}
		if (allowSelf === 'none' && target.data.accountId === playerCharacter.data.accountId) {
			return {
				success: false,
				error: `This command doesn't allow targeting your account.`,
			};
		}
		if (filter != null && !filter({ character: target, characterState })) {
			return {
				success: false,
				error: `${target.name} (${target.id}) is not a valid target for this command.`,
			};
		}
		return {
			success: true,
			value: target,
		};
	},
	// No autocomplete implementation: That is handled on the client
	getBotProcessor({ gameState, character: playerCharacter }) {
		return {
			type: 'character',
			allowSelf,
			// Only name the characters if filter is set, otherwise the filtered list matches `allowSelf`
			allowedCharacters: filter != null ? (
				gameState.characters
					.filter((c) => allowSelf === 'any' || c.id !== playerCharacter.id)
					.filter((c) => allowSelf !== 'none' || c.data.accountId !== playerCharacter.data.accountId)
					.filter((character) => {
						const characterState = gameState.globalState.getCharacterState(character.id);
						if (characterState == null)
							return false;

						return filter == null || filter({ character, characterState });
					})
					.map((character) => character.id)
			) : undefined,
		};
	},
});
