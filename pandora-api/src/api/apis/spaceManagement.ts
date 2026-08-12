import { Result, SpaceDirectoryConfigSchema, type SpaceDirectoryConfig, type SpaceId } from 'pandora-common';
import type { InternalApiDirectory } from '../../internal/apiDirectory.ts';

export type CreateSpaceError =
	| { type: 'error'; error: Error; }
	| { type: 'invalidArgument'; parseError: unknown; }
	| { type: 'notAllowed'; }
	| { type: 'spaceOwnershipLimitReached'; }
	| { type: 'accountListNotAllowed'; }
	| { type: 'failed'; };

export type AbandonSpaceError =
	| { type: 'error'; error: Error; }
	| { type: 'notAllowed'; }
	| { type: 'notFound'; }
	| { type: 'notAnOwner'; }
	| { type: 'failed'; };

/** APIs related to space management (creation, deletion, configuration, ...). */
export class PandoraApiSpaceManagement {
	private readonly _internal: InternalApiDirectory;

	private constructor(internal: InternalApiDirectory) {
		this._internal = internal;
	}

	/**
	 * Create a new space. Requires the `spaces:create` token scope.
	 *
	 * **EXPERIMENTAL API** - Might change substantially or even be removed in future versions.
	 *
	 * Possible errors:
	 * - `error` - Error during the request, usually a network error.
	 * - `invalidArgument` - Invalid configuration (e.g. too large argument, too many values, invalid combination of values, ...). See `parseError` for more details.
	 * - `notAllowed` - Missing token scope or the account is missing role necessary for specific configuration option (e.g. development options are restricted).
	 * - `spaceOwnershipLimitReached` - Account has a limit of how many spaces can be owned.
	 * - `accountListNotAllowed` - Filling admin and allow lists in advance is not allowed for API - add accounts after target character joins the space.
	 * - `failed` - Internal failure on Pandora's server - retry later.
	 *
	 * @param config - Configuration for the space. Unstable argument - might change over time.
	 * @returns Result containing either id of the new space or reason for failure.
	 */
	public async createSpace(config: SpaceDirectoryConfig): Promise<Result<{
		id: SpaceId;
	}, CreateSpaceError>> {
		const parsedConfig = SpaceDirectoryConfigSchema.safeParse(config);
		if (!parsedConfig.success) {
			return Result.Err({
				type: 'invalidArgument',
				parseError: parsedConfig.data,
			});
		}

		try {
			const response = await this._internal.directoryConnector.awaitResponse('spaceCreate', {
				config: parsedConfig.data,
			});
			if (response.result === 'ok') {
				return Result.Ok({
					id: response.id,
				});
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
	 * Drop own ownership of a space, deleting it if the current account was the last owner.
	 * Requires the `spaces:disown` token scope.
	 *
	 * **EXPERIMENTAL API** - Might change substantially or even be removed in future versions.
	 *
	 * Possible errors:
	 * - `error` - Error during the request, usually a network error.
	 * - `notAllowed` - Missing token scope.
	 * - `notFound` - The specified space does not exist.
	 * - `notAnOwner` - The specified space exists, but the account its not in the owner list. Note, that spaces only get deleted after all owners abandon it.
	 * - `failed` - Internal failure on Pandora's server - retry later.
	 *
	 * @param space - Id of the space to abandon.
	 * @returns Result either reporting success or reason for failure.
	 */
	public async abandonSpace(space: SpaceId): Promise<Result<void, AbandonSpaceError>> {
		try {
			const response = await this._internal.directoryConnector.awaitResponse('spaceAbandon', {
				space,
			});
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

	/** @internal */
	public static _create(internal: InternalApiDirectory): PandoraApiSpaceManagement {
		return new PandoraApiSpaceManagement(internal);
	}
}
