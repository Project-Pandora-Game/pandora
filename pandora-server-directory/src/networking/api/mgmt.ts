import express, { Router } from 'express';
import { DirectoryStatusAnnouncementSchema, ParseNotNullable } from 'pandora-common';
import { CreateUpdateGitHubRequest, GenerateUpdateDraft, UpdateDraftOptionsSchema } from 'pandora-common/updates';
import { ENV } from '../../config.ts';
import type { ActorIdentity } from '../../account/actorIdentity.ts';
import { AUDIT_LOG } from '../../logging.ts';
import { ConnectionManagerClient } from '../manager_client.ts';
import { GetApiRequestActor } from './_utils.ts';
import { PandoraApiManagementTestForceloadSpaces } from './mgmt/test/forceload_spaces.ts';

export type PandoraApiManagementLocals = {
	actor: ActorIdentity;
};

export function PandoraApiManagement(): Router {
	const auditLog = AUDIT_LOG.prefixMessages('[PandoraApiManagement]');
	const router = Router();

	router.use<unknown, unknown, unknown, unknown, Partial<PandoraApiManagementLocals>>(async function (req, res, next) {
		const actor = await GetApiRequestActor(req);
		if (actor == null) {
			res.sendStatus(401);
			return;
		}

		if (!actor.roles.isAuthorized('lead-developer')) {
			res.sendStatus(403);
			return;
		}

		res.locals.actor = actor;
		return next();
	});

	// This route inherits the lead-developer authorization above and only reads GitHub.
	let updateDraftRunning = false;
	router.post('/updates/draft', express.json({ limit: '8kb' }), async (req, res) => {
		const options = UpdateDraftOptionsSchema.safeParse(req.body);
		if (!options.success) {
			res.status(400).json({ error: 'Invalid base or target reference.' });
			return;
		}
		if (updateDraftRunning) {
			res.status(429).json({ error: 'An update draft is already being generated. Please try again when it finishes.' });
			return;
		}
		updateDraftRunning = true;
		try {
			const request = CreateUpdateGitHubRequest((url, headers) => fetch(url, { headers, signal: AbortSignal.timeout(30_000), redirect: 'error' }), ENV.PANDORA_UPDATES_GITHUB_TOKEN);
			const draft = await GenerateUpdateDraft(request, options.data);
			res.json(draft);
		} catch (error) {
			auditLog.warning('Error generating update draft:', error);
			res.status(502).json({ error: error instanceof Error ? error.message : 'Failed to generate update draft.' });
		} finally {
			updateDraftRunning = false;
		}
	});

	router.route('/announcement')
		.put<unknown, unknown, unknown, unknown, Partial<PandoraApiManagementLocals>>(
			express.json(),
			(req, res) => {
				const actor = ParseNotNullable(res.locals.actor);
				const announcement = DirectoryStatusAnnouncementSchema.safeParse(req.body);

				if (!announcement.success) {
					res.sendStatus(400);
					return;
				}

				auditLog.info(`${actor.username} (${actor.id}) set announcement to:\n`, announcement.data);

				ConnectionManagerClient.setAnnouncement(announcement.data);
				res.sendStatus(204);
			},
		)
		.delete<unknown, unknown, unknown, unknown, Partial<PandoraApiManagementLocals>>((_req, res) => {
			const actor = ParseNotNullable(res.locals.actor);

			auditLog.info(`${actor.username} (${actor.id}) cleared announcement`);

			ConnectionManagerClient.setAnnouncement(null);
			res.sendStatus(204);
		});

	PandoraApiManagementTestForceloadSpaces(router);

	return router;
}
