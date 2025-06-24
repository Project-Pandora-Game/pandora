import express, { Router } from 'express';
import { DirectoryStatusAnnouncementSchema, ParseNotNullable } from 'pandora-common';
import type { ActorIdentity } from '../../account/actorIdentity.ts';
import { AUDIT_LOG } from '../../logging.ts';
import { ConnectionManagerClient } from '../manager_client.ts';
import { GetApiRequestActor } from './_utils.ts';

export function PandoraApiManagement(): Router {
	const auditLog = AUDIT_LOG.prefixMessages('[PandoraApiManagement]');
	const router = Router();

	type Locals = {
		actor: ActorIdentity;
	};

	router.use<unknown, unknown, unknown, unknown, Partial<Locals>>(async function (req, res, next) {
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

	router.route('/announcement')
		.put<unknown, unknown, unknown, unknown, Partial<Locals>>(
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
		.delete<unknown, unknown, unknown, unknown, Partial<Locals>>((_req, res) => {
			const actor = ParseNotNullable(res.locals.actor);

			auditLog.info(`${actor.username} (${actor.id}) cleared announcement`);

			ConnectionManagerClient.setAnnouncement(null);
			res.sendStatus(204);
		});

	return router;
}
