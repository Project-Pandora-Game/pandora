import { Request } from 'express';
import { SplitStringFirstOccurrence } from 'pandora-common';
import { Account } from '../../account/account.ts';
import { accountManager } from '../../account/accountManager.ts';
import type { ActorIdentity } from '../../account/actorIdentity.ts';
import { ACTOR_PANDORA } from '../../account/actorPandora.ts';
import { ENV } from '../../config.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function GetApiRequestActor(req: Request<any, any, any, any, any>): Promise<ActorIdentity | null> {
	// Get authorization header from the request
	const header = req.headers.authorization;

	if (typeof header !== 'string')
		return null;

	// Expect valid basic authorization
	const match = /^ *basic +([A-Za-z0-9._~+/-]+=*) *$/i.exec(header);
	if (match == null)
		return null;

	// Parse the outer encoding and split based on ":"
	const [encodedUser, token] = SplitStringFirstOccurrence(Buffer.from(match[1], 'base64').toString('utf-8'), ':');

	// If user is "0", then it is Pandora itself
	if (encodedUser === '0') {
		// In that case check against config token
		const pandoraToken = ENV.ADMIN_ENDPOINT_TOKEN.trim();

		if (!!pandoraToken && pandoraToken === token.trim())
			return ACTOR_PANDORA;

		return null;
	}

	// User is encoded with base64 too, to allow any character inside
	const user = Buffer.from(encodedUser, 'base64').toString('utf-8');

	// Find account and validate the token
	const account = await accountManager.loadAccountByUsername(user);
	const matchedToken = account?.secure.getLoginToken(token);

	// Verify the token validity
	if (account == null || matchedToken == null)
		return null;

	return account;
}

export async function GetApiRequestAccount(req: Request): Promise<Account | null> {
	const account = await GetApiRequestActor(req);
	return (account != null && account instanceof Account) ? account : null;
}
