import { Option, Result, type AccountId, type PandoraAccessTokenScopeList } from 'pandora-common';
import type { InternalApiDirectory } from '../../internal/apiDirectory.ts';

/** APIs related to working with Pandora tokens. */
export class PandoraApiToken {
	private readonly _internal: InternalApiDirectory;

	private constructor(internal: InternalApiDirectory) {
		this._internal = internal;
	}

	public async getCurrentTokenInfo(): Promise<Result<{
		/** Id of the account this token is for. */
		accountId: AccountId;
		/** Unique Id of the token within this account (NOT the token itself). Can be used in other token-based APIs to select this token. */
		tokenId: string;
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
				tokenScopes: response.tokenScopes,
				tokenExpires: response.tokenExpires != null ? Option.Some(new Date(response.tokenExpires)) : Option.None,
			});
		} catch (err) {
			return Result.Err(new Error('Request failed', { cause: err }));
		}
	}

	/** @private */
	public static create(internal: InternalApiDirectory): PandoraApiToken {
		return new PandoraApiToken(internal);
	}
}
