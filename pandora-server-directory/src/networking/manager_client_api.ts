import express, { Request, Router } from 'express';
import { Assert, CharacterIdSchema, GetLogger, LIMIT_CHARACTER_PREVIEW_SIZE, SplitStringFirstOccurrence } from 'pandora-common';
import type { Account } from '../account/account.ts';
import { accountManager } from '../account/accountManager.ts';
import { GetDatabase } from '../database/databaseProvider.ts';

async function GetRequestAccount(req: Request): Promise<Account | null> {
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

export function PandoraPublicApi(): Router {
	const logger = GetLogger('PandoraPublicApi');
	const router = Router();

	router.use(function (req, res, next) {
		res.header('Access-Control-Allow-Origin', req.get('Origin') || '*');
		res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE');
		res.header('Access-Control-Expose-Headers', 'Content-Length');
		res.header('Access-Control-Allow-Headers', 'Accept, Authorization, Content-Type, X-Requested-With, Range');
		if (req.method === 'OPTIONS') {
			return res.sendStatus(200);
		} else {
			return next();
		}
	});

	router.get('/character/:characterId/preview', (req, res) => {
		const characterIdParsed = CharacterIdSchema.safeParse(req.params.characterId);
		if (!characterIdParsed.success) {
			res.sendStatus(400);
			return;
		}

		GetRequestAccount(req)
			.then((account) => {
				if (account == null) {
					res.sendStatus(401);
					return;
				}

				if (!account.hasCharacter(characterIdParsed.data)) {
					res.sendStatus(403);
					return;
				}

				return GetDatabase().getCharacterPreview(characterIdParsed.data)
					.then((result) => {
						res.header('Cache-Control', 'private, max-age=0, must-revalidate');
						if (result == null) {
							res.sendStatus(404);
							return;
						}
						res
							.contentType('image/png')
							.send(result);
					});
			})
			.catch((err) => {

				logger.error('Error processing get character preview request:', err);
				res.sendStatus(500);
			});

	});

	router.put('/character/:characterId/preview',
		express.raw({ type: 'image/png', limit: LIMIT_CHARACTER_PREVIEW_SIZE }),
		(req, res) => {
			const characterIdParsed = CharacterIdSchema.safeParse(req.params.characterId);
			if (!characterIdParsed.success || !(req.body instanceof Buffer)) {
				res.sendStatus(400);
				return;
			}

			GetRequestAccount(req)
				.then((account) => {
					Assert(req.body instanceof Buffer);
					if (account == null) {
						res.sendStatus(401);
						return;
					}

					if (!account.hasCharacter(characterIdParsed.data)) {
						res.sendStatus(403);
						return;
					}

					return GetDatabase().setCharacterPreview(characterIdParsed.data, new Uint8Array(req.body))
						.then((result) => {
							if (!result) {
								res.sendStatus(404);
								return;
							}
							res.sendStatus(204);
						});
				})
				.catch((err) => {
					logger.error('Error processing get character preview request:', err);
					res.sendStatus(500);
				});
		},
	);

	return router;
}
