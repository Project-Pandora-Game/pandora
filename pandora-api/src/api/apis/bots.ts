import { Result } from 'pandora-common';
import { type BotDirectoryStateInfo, type BotId } from 'pandora-common/bots';
import type { InternalApiDirectory } from '../../internal/apiDirectory.ts';

export type BotRunRegisterError =
	| { type: 'error'; error: Error; }
	| { type: 'notAllowed'; }
	| { type: 'notFound'; };

export type BotRunUnregisterError =
	| { type: 'error'; error: Error; }
	| { type: 'notFound'; };

/** APIs related to running bots (registering a connection, connecting to a bot's presence in a space). */
export class PandoraApiBots {
	private readonly _internal: InternalApiDirectory;

	private constructor(internal: InternalApiDirectory) {
		this._internal = internal;
	}

	/**
	 * Register this connection as one running the bot with the given id.
	 * Requires the owner account to own this bot and the `bots:run` token scope.
	 * After the connection is registered for running the specified bot, the connection will start receiving the `botStateChanged` event.
	 *
	 * Note, that the registration **needs to happen after every re-connect** as well!
	 *
	 * **EXPERIMENTAL API** - Might change substantially or even be removed in future versions.
	 *
	 * Possible errors:
	 * - `error` - Error during the request, usually a network error.
	 * - `notAllowed` - Missing token scope.
	 * - `notFound` - Bot not found or not owned by the token's account.
	 *
	 * @param bot - Id of the bot to register this connection for.
	 * @returns Result either reporting success or reason for failure.
	 */
	public async botRunRegister(bot: BotId): Promise<Result<void, BotRunRegisterError>> {
		try {
			const response = await this._internal.directoryConnector.awaitResponse('botRunRegister', { bot });
			if (response.result === 'ok') {
				return Result.Ok(undefined);
			}
			return Result.Err({
				type: response.result,
			});
		} catch (err) {
			return Result.Err({
				type: 'error',
				error: new Error('Request failed', { cause: err }),
			});
		}
	}

	/**
	 * Stop receiving events related to the bot registered using `botRunRegister`.
	 *
	 * **EXPERIMENTAL API** - Might change substantially or even be removed in future versions.
	 *
	 * Possible errors:
	 * - `error` - Error during the request, usually a network error.
	 * - `notFound` - Bot is not registered by this connection.
	 *
	 * @param bot - Id of the bot to unregister from this connection.
	 * @returns Result either reporting success or reason for failure.
	 */
	public async botRunUnregister(bot: BotId): Promise<Result<void, BotRunUnregisterError>> {
		try {
			const response = await this._internal.directoryConnector.awaitResponse('botRunUnregister', { bot });
			if (response.result === 'ok') {
				return Result.Ok(undefined);
			}
			return Result.Err({
				type: response.result,
			});
		} catch (err) {
			return Result.Err({
				type: 'error',
				error: new Error('Request failed', { cause: err }),
			});
		}
	}

	/**
	 * Subscribe to bot state change events for registered bots.
	 *
	 * @param listener - Callback invoked with bot state data.
	 * @returns Function to unsubscribe from events.
	 */
	public onBotStateChanged(
		listener: (data: { bot: BotId; state: BotDirectoryStateInfo; }) => void,
	): () => void {
		return this._internal.directoryConnector.on('botStateChanged', listener);
	}

	/** @internal */
	public static _create(internal: InternalApiDirectory): PandoraApiBots {
		return new PandoraApiBots(internal);
	}
}
