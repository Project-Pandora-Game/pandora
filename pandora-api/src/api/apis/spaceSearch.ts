import { LIMIT_SPACE_SEARCH_COUNT, Result, SpaceSearchArgumentsSchema, type SpaceListInfo, type SpaceSearchArguments, type SpaceSearchResult } from 'pandora-common';
import type { InternalApiDirectory } from '../../internal/apiDirectory.ts';

export type ListActivePublicSpacesError =
	| { type: 'error'; error: Error; };

export type SearchPublicSpacesError =
	| { type: 'error'; error: Error; }
	| { type: 'invalidArgument'; invalidArgument: 'searchArgs' | 'limit' | 'skip'; };

/** APIs related to finding spaces. */
export class PandoraApiSpaceSearch {
	private readonly _internal: InternalApiDirectory;

	private constructor(internal: InternalApiDirectory) {
		this._internal = internal;
	}

	/**
	 * List currently active public spaces.
	 * This does NOT return the same list as client - Spaces that are private but visible to the current account are NOT included.
	 * @returns Result containing either list of spaces or reason for failure.
	 */
	public async listActivePublicSpaces(): Promise<Result<Omit<SpaceListInfo, 'hasFriend'>[], ListActivePublicSpacesError>> {
		try {
			const response = await this._internal.directoryConnector.awaitResponse('spacePublicActiveList', {});
			return Result.Ok(response.spaces);
		} catch (err) {
			return Result.Err({
				type: 'error',
				error: new Error('Request failed', { cause: err }),
			});
		}
	}

	/**
	 * Search through public spaces, whether active or not.
	 * This method returns the same results as client's "Search Public Spaces" view.
	 * @param searchArgs - Arguments for search filtering and sorting.
	 * @param limit - Limit of how many spaces to return. Can be at most `LIMIT_SPACE_SEARCH_COUNT`.
	 * @param skip - How many spaces to skip. Call the method multiple times with increasing `skip` to retrieve all the spaces.
	 * @returns Result containing either list of spaces or reason for failure.
	 */
	public async searchPublicSpaces(
		searchArgs: SpaceSearchArguments,
		limit: number = LIMIT_SPACE_SEARCH_COUNT,
		skip?: number,
	): Promise<Result<SpaceSearchResult, SearchPublicSpacesError>> {
		const parsedSearchArgs = SpaceSearchArgumentsSchema.safeParse(searchArgs);
		if (!parsedSearchArgs.success)
			return Result.Err({ type: 'invalidArgument', invalidArgument: 'searchArgs' });

		if (!Number.isSafeInteger(limit) || limit < 1 || limit > LIMIT_SPACE_SEARCH_COUNT)
			return Result.Err({ type: 'invalidArgument', invalidArgument: 'limit' });

		if (skip !== undefined && (!Number.isSafeInteger(skip) || skip < 0))
			return Result.Err({ type: 'invalidArgument', invalidArgument: 'skip' });

		try {
			const response = await this._internal.directoryConnector.awaitResponse('spacePublicSearch', {
				args: searchArgs,
				limit,
				skip: skip || undefined,
			});
			return Result.Ok(response.result);
		} catch (err) {
			return Result.Err({
				type: 'error',
				error: new Error('Request failed', { cause: err }),
			});
		}
	}

	/** @private */
	public static _create(internal: InternalApiDirectory): PandoraApiSpaceSearch {
		return new PandoraApiSpaceSearch(internal);
	}
}
