import { GetLogger, IsNotNullable, type CharacterId, type CommandRunner, type ICommandExecutionContext, type IEmpty, type Promisable } from 'pandora-common';
import type { BotCommandDescriptor, BotCommandGetStructureResult, BotCommandRunResult } from 'pandora-common/bots';
import type { BotConnection } from '../connection/botConnection.ts';
import type { BotCommandRouter } from './commandRouter.ts';

export interface BotCommandRepositoryRegisteredCommand<TCommandExecutionContext extends ICommandExecutionContext> {
	/** One or more "keys" of the command - the text which is used to trigger it. E.g. command with key "c" can be run using "!c" */
	key: string | [string, ...string[]];
	/** Short description of the command. Shown in the command list. */
	description: string;
	/** Long description of the command. Shown when user enters just the command name. Optional - defaults to `description`. */
	longDescription?: string;
	/** Text shown after the command name, before description. */
	usage?: string;
	/** Optional filter for whether the command is available in the specified context. */
	isAvailable?(context: TCommandExecutionContext): Promisable<boolean>;
	/** Handler used for running the command and providing data to the clients. */
	handler: CommandRunner<TCommandExecutionContext, IEmpty>;
}

/**
 * Bot Command Repository is first-party implementation of bot command router.
 *
 * This class handles all command processing, except creation of context, allowing implementations with custom context generation.
 */
export abstract class BotCommandRepositoryBase<TCommandExecutionContext extends ICommandExecutionContext> implements BotCommandRouter {
	public commands: BotCommandRepositoryRegisteredCommand<TCommandExecutionContext>[] = [];

	/**
	 * Register a command into this repository.
	 */
	public registerCommand(...command: BotCommandRepositoryRegisteredCommand<TCommandExecutionContext>[]): this {
		this.commands.push(...command);
		return this;
	}

	/**
	 * Create a context for command handling.
	 * Might return `null` on failure.
	 * @param characterId - Id of the character that is requesting the run
	 * @param connection - Bot connection to the server
	 * @param commandName - Name of the command the context is for
	 * @param executionType - What is being done to the command
	 * @param displayError - Optional helper for displaying error messages. Only supported during run.
	 */
	protected abstract createCommandContext(
		characterId: CharacterId,
		connection: BotConnection,
		commandName: string,
		executionType: ICommandExecutionContext['executionType'],
		displayError?: (error: string) => void,
	): TCommandExecutionContext | null;

	//#region Request handlers

	public async getCommands(
		characterId: CharacterId,
		connection: BotConnection,
	): Promise<BotCommandDescriptor[]> {
		// Get all available commands
		const commands = this.commands.slice();
		// eslint-disable-next-line @typescript-eslint/await-thenable
		const available = await Promise.all(commands.map((c) => {
			if (c.isAvailable == null)
				return true;

			const context = this.createCommandContext(
				characterId,
				connection,
				typeof c.key === 'string' ? c.key : c.key[0],
				'help',
			);
			return context != null && c.isAvailable(context);
		}));

		return commands
			.filter((_, idx) => available[idx])
			.map((command): BotCommandDescriptor => ({
				key: command.key,
				description: command.description,
				longDescription: command.longDescription,
				usage: command.usage,
			}));
	}

	public async getCommandStructurePart(
		commandName: string,
		args: string[],
		characterId: CharacterId,
		connection: BotConnection,
	): Promise<BotCommandGetStructureResult> {
		// Find the command among known commands
		const command = await this._getCommand(commandName, characterId, connection, 'autocomplete');

		if (command == null)
			return { result: 'invalidCommand' };

		// Run structure handler
		const context = this.createCommandContext(characterId, connection, commandName, 'autocomplete');
		if (context == null) {
			return { result: 'invalidCommand' };
		}

		return (await command.handler.getNextBotSegmentInfo(context, {}, args))
			.map_or_else(
				(error): BotCommandGetStructureResult => {
					return {
						result: 'invalidArguments',
						message: error.message,
						validCount: error.validCount,
					};
				},
				(result): BotCommandGetStructureResult => {
					return {
						result: 'ok',
						header: result.header,
						nextSegment: result.nextSegment,
					};
				},
			);
	}

	public async runCommand(
		commandName: string,
		args: string[],
		characterId: CharacterId,
		connection: BotConnection,
	): Promise<BotCommandRunResult> {

		// Find the command among known commands
		const command = await this._getCommand(commandName, characterId, connection, 'run');

		if (command == null)
			return { result: 'invalidCommand' };

		// Run the command
		let error = '';
		const context = this.createCommandContext(
			characterId,
			connection,
			commandName,
			'run',
			(err) => {
				error += (error ? '\n' : '') + err;
			},
		);
		if (context == null) {
			return { result: 'invalidCommand' };
		}

		const result = (await command.handler.runTokenized(context, {}, args));

		if (result) {
			if (error) {
				GetLogger(this.constructor.name).warning(`Running command '${commandName}' succeeded, but produced error text:`, error);
			}
			return { result: 'ok' };
		} else {
			// TODO: Support invalidArguments error

			return {
				result: 'runError',
				message: error || undefined,
			};
		}
	}

	private async _getCommand(
		commandName: string,
		characterId: CharacterId,
		connection: BotConnection,
		executionType: ICommandExecutionContext['executionType'],
	): Promise<BotCommandRepositoryRegisteredCommand<TCommandExecutionContext> | null> {
		return (await Promise.all(this.commands.map(async (c) => {
			// Key must match exactly
			if (typeof c.key === 'string' ? c.key !== commandName : !c.key.includes(commandName))
				return null;

			if (c.isAvailable == null)
				return c;

			const context = this.createCommandContext(
				characterId,
				connection,
				commandName,
				executionType,
			);
			return (context != null && await c.isAvailable(context)) ? c : null;
		}))).find(IsNotNullable) ?? null;
	}

	//#endregion
}
