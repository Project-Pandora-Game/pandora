import express, { Router } from 'express';
import { Assert, CharacterIdSchema, LIMIT_CHARACTER_PREVIEW_SIZE } from 'pandora-common';
import { GetDatabase } from '../../database/databaseProvider.ts';
import { GetApiRequestAccount } from './_utils.ts';

export function PandoraApiCharacter(): Router {
	const router = Router();

	router.route('/:characterId/preview')
		.get(async (req, res) => {
			const characterIdParsed = CharacterIdSchema.safeParse(req.params.characterId);
			if (!characterIdParsed.success) {
				res.sendStatus(400);
				return;
			}

			const account = await GetApiRequestAccount(req);
			if (account == null) {
				res.sendStatus(401);
				return;
			}

			if (!account.hasCharacter(characterIdParsed.data)) {
				res.sendStatus(403);
				return;
			}

			const result = await GetDatabase().getCharacterPreview(characterIdParsed.data);
			res.header('Cache-Control', 'private, max-age=0, must-revalidate');
			if (result == null) {
				res.sendStatus(404);
				return;
			}
			res
				.contentType('image/png')
				.send(result);
		})
		.put(
			express.raw({ type: 'image/png', limit: LIMIT_CHARACTER_PREVIEW_SIZE }),
			async (req, res) => {
				const characterIdParsed = CharacterIdSchema.safeParse(req.params.characterId);
				if (!characterIdParsed.success || !(req.body instanceof Buffer)) {
					res.sendStatus(400);
					return;
				}

				const account = await GetApiRequestAccount(req);
				Assert(req.body instanceof Buffer);
				if (account == null) {
					res.sendStatus(401);
					return;
				}

				if (!account.hasCharacter(characterIdParsed.data)) {
					res.sendStatus(403);
					return;
				}

				const result = await GetDatabase().setCharacterPreview(characterIdParsed.data, new Uint8Array(req.body));
				if (!result) {
					res.sendStatus(404);
					return;
				}
				res.sendStatus(204);
			},
		);

	return router;
}
