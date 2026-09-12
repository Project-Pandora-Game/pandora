import { CreateCommand, GetLogger, type CharacterId, type CommandBuilder, type ICommandExecutionContext, type IEmpty } from 'pandora-common';
import type { BotConnection } from '../connection/botConnection.ts';
import type { BotSpaceCharacter } from '../state/botSpaceCharacter.ts';
import type { BotSpaceState } from '../state/botSpaceState.ts';
import { BotCommandRepositoryBase } from './commandRepositoryBase.ts';

export interface BotCommandRepositoryCommandContext extends ICommandExecutionContext {
	/** Bot's Shard connection */
	connection: BotConnection;
	/** Currently loaded state of the space */
	gameState: BotSpaceState;
	/** The character running the command */
	character: BotSpaceCharacter;
}

/**
 * Bot Command Repository is first-party implementation of bot command router.
 *
 * You can create new commands by calling `registerCommand` with handler created using `CreateBotRepositoryCommand`.
 *
 * It works by allowing you to define commands and their metadata such as descriptions, filters, and arguments using our command builder.
 * Whenever a command request from client arrives, it then processes it based on the given commands,
 * automatically injecting some additional context from the current space for the commands to use.
 *
 * _Note_: If you want to make use of repository's builder but need a custom context, you can implement extension of `BotCommandRepositoryBase` similar to this class.
 */
export class BotCommandRepository extends BotCommandRepositoryBase<BotCommandRepositoryCommandContext> {
	private readonly logger = GetLogger('BotCommandRepository');

	protected override createCommandContext(
		characterId: CharacterId,
		connection: BotConnection,
		commandName: string,
		executionType: ICommandExecutionContext['executionType'],
		displayError?: (error: string) => void,
	): BotCommandRepositoryCommandContext | null {
		const gameState = connection.gameState;
		if (gameState == null) {
			this.logger.warning('Rejecting command request while we do not have game state.');
			return null;
		}

		const character = gameState.characters.find((c) => c.id === characterId);
		if (character == null) {
			this.logger.warning(`Rejecting command request from unknown character ${characterId}.`);
			return null;
		}

		return {
			executionType,
			displayError,
			commandName,
			connection,
			gameState,
			character,
		};
	}
}

export function CreateBotRepositoryCommand(): CommandBuilder<BotCommandRepositoryCommandContext, IEmpty, IEmpty> {
	return CreateCommand<BotCommandRepositoryCommandContext>();
}
