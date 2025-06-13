import express, { Router } from 'express';
import { Assert, CharacterIdSchema, GetLogger, LIMIT_CHARACTER_PREVIEW_SIZE } from 'pandora-common';
import { GetDatabase } from '../../database/databaseProvider.ts';
import { GetApiRequestAccount } from './_utils.ts';

export function PandoraApiCharacter(): Router {
	const logger = GetLogger('PandoraApiCharacter');
	const router = Router();

	router.get('/:characterId/preview', (req, res) => {
		const characterIdParsed = CharacterIdSchema.safeParse(req.params.characterId);
		if (!characterIdParsed.success) {
			res.sendStatus(400);
			return;
		}

		GetApiRequestAccount(req)
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

	router.put('/:characterId/preview',
		express.raw({ type: 'image/png', limit: LIMIT_CHARACTER_PREVIEW_SIZE }),
		(req, res) => {
			const characterIdParsed = CharacterIdSchema.safeParse(req.params.characterId);
			if (!characterIdParsed.success || !(req.body instanceof Buffer)) {
				res.sendStatus(400);
				return;
			}

			GetApiRequestAccount(req)
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
