import express, { Router } from 'express';
import { DirectoryStatusAnnouncementSchema, GetLogger, ParseNotNullable } from 'pandora-common';
import type { ActorIdentity } from '../../account/actorIdentity.ts';
import { AUDIT_LOG } from '../../logging.ts';
import { ConnectionManagerClient } from '../manager_client.ts';
import { GetApiRequestActor } from './_utils.ts';

export function PandoraApiManagement(): Router {
	const logger = GetLogger('PandoraApiManagement');
	const auditLog = AUDIT_LOG.prefixMessages('[PandoraApiManagement]');
	const router = Router();

	type Locals = {
		actor: ActorIdentity;
	};

	router.use<unknown, unknown, unknown, unknown, Partial<Locals>>(function (req, res, next) {
		GetApiRequestActor(req)
			.then((actor) => {
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
			})
			.catch((err) => {
				logger.error('Error processing request:', err);
				res.sendStatus(500);
			});
	});

	router.put<unknown, unknown, unknown, unknown, Partial<Locals>>('/announcement',
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
	);

	router.delete<unknown, unknown, unknown, unknown, Partial<Locals>>('/announcement', (_req, res) => {
		const actor = ParseNotNullable(res.locals.actor);

		auditLog.info(`${actor.username} (${actor.id}) cleared announcement`);

		ConnectionManagerClient.setAnnouncement(null);
		res.sendStatus(204);
	});

	return router;
}
