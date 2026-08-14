import { Option, Result, type AccountId, type PandoraAccessTokenScopeList } from 'pandora-common';
import type { InternalApiDirectory } from '../../internal/apiDirectory.ts';

export type DeleteTokenError =
	| { type: 'error'; error: Error; }
	| { type: 'notAllowed'; }
	| { type: 'notFound'; };

/** APIs related to working with Pandora tokens. */
export class PandoraApiToken {
	private readonly _internal: InternalApiDirectory;

	private constructor(internal: InternalApiDirectory) {
		this._internal = internal;
	}

	/**
	 * Get information about the token that is currently being used.
	 * @returns The authenticated account id and information about the token, if successful.
	 */
	public async getCurrentTokenInfo(): Promise<Result<{
		/** Id of the account this token is for. */
		accountId: AccountId;
		/** Unique Id of the token within this account (NOT the token itself). Can be used in other token-based APIs to select this token. */
		tokenId: string;
		/** Name of the token, as specified by the user. */
		tokenName: string;
		/** List of scopes this token has been granted. */
		tokenScopes: PandoraAccessTokenScopeList;
		/** Time when this token expires, or `None` if it does not expire. */
		tokenExpires: Option<Date>;
	}, Error>> {
		try {
			const response = await this._internal.directoryConnector.awaitResponse('getTokenInfo', {});
			return Result.Ok({
				accountId: response.accountId,
				tokenId: response.tokenId,
				tokenName: response.tokenName,
				tokenScopes: response.tokenScopes,
				tokenExpires: response.tokenExpires != null ? Option.Some(new Date(response.tokenExpires)) : Option.None,
			});
		} catch (err) {
			return Result.Err(new Error('Request failed', { cause: err }));
		}
	}

	/**
	 * Delete (invalidate) a token. Currently only currently used token can be invalidated.
	 * @param tokenId - Token to invalidate, identified by per-account ID (see `getCurrentTokenInfo`).
	 * @returns Result of the action.
	 */
	public async deleteToken(tokenId: string): Promise<Result<void, DeleteTokenError>> {
		try {
			const response = await this._internal.directoryConnector.awaitResponse('deleteToken', { tokenId });
			if (response.result === 'ok') {
				return Result.Ok(undefined);
			} else {
				return Result.Err({ type: response.result });
			}
		} catch (err) {
			return Result.Err({ type: 'error', error: new Error('Request failed', { cause: err }) });
		}
	}

	/**
	 * Delete (invalidate) the token that is currently being used. Note, that this will immediately cut the connection.
	 * @returns Result of the action.
	 */
	public async deleteCurrentToken(): Promise<Result<void, DeleteTokenError>> {
		try {
			const response = await this._internal.directoryConnector.awaitResponse('deleteToken', { tokenId: null });
			if (response.result === 'ok') {
				return Result.Ok(undefined);
			} else {
				return Result.Err({ type: response.result });
			}
		} catch (err) {
			return Result.Err({ type: 'error', error: new Error('Request failed', { cause: err }) });
		}
	}

	/** @internal */
	public static _create(internal: InternalApiDirectory): PandoraApiToken {
		return new PandoraApiToken(internal);
	}
}
