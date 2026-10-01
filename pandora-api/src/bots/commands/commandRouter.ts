import type { CharacterId, Promisable } from 'pandora-common';
import type { BotCommandDescriptor, BotCommandGetStructureResult, BotCommandRunResult } from 'pandora-common/bots';
import type { BotConnection } from '../connection/botConnection.ts';

/**
 * Command Router is a type that can process any command-related requests from the client.
 */
export interface BotCommandRouter {
	/**
	 * Get commands available to a specific character.
	 * @param characterId - The character to query commands for.
	 * @param connection - Connection the request came from.
	 */
	getCommands(
		characterId: CharacterId,
		connection: BotConnection,
	): Promisable<BotCommandDescriptor[]>;

	/**
	 * Get command parsing information for the client.
	 * Needed so client knows how to tokenize the command and optionally to provide autocomplete and hints to the users about the command usage.
	 *
	 * @param command - The command being used (without `!` prefix)
	 * @param args - Tokenized arguments the user entered so far (excluding the one the info is being queried for).
	 * @param characterId - The character to query commands for.
	 * @param connection - Connection the request came from.
	 */
	getCommandStructurePart(
		command: string,
		args: string[],
		characterId: CharacterId,
		connection: BotConnection,
	): Promisable<BotCommandGetStructureResult>;

	/**
	 * Process a command that user ran.
	 *
	 * @param command - The command being used (without `!` prefix)
	 * @param args - Tokenized arguments the user entered.
	 * @param characterId - The character to query commands for.
	 * @param connection - Connection the request came from.
	 */
	runCommand(
		command: string,
		args: string[],
		characterId: CharacterId,
		connection: BotConnection,
	): Promisable<BotCommandRunResult>;
}
