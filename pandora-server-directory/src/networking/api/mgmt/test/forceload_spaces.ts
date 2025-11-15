import type { Router } from 'express';
import { GetLogger, ParseNotNullable, type SpaceId } from 'pandora-common';
import { GetDatabase } from '../../../../database/databaseProvider.ts';
import { IsStopping } from '../../../../lifecycle.ts';
import { AUDIT_LOG } from '../../../../logging.ts';
import type { PandoraApiManagementLocals } from '../../mgmt.ts';
import { SpaceManager } from '../../../../spaces/spaceManager.ts';
import { Sleep } from '../../../../utility.ts';

export function PandoraApiManagementTestForceloadSpaces(router: Router) {
	const auditLog = AUDIT_LOG.prefixMessages('[PandoraApiManagement]');

	router.route('/test/forceload_spaces')
		.post<unknown, unknown, unknown, unknown, Partial<PandoraApiManagementLocals>>(
			(req, res) => {
				const actor = ParseNotNullable(res.locals.actor);

				auditLog.alert(`${actor.username} (${actor.id}) triggered test force-load of spaces!`);

				const db = GetDatabase();
				db.searchSpace({ sort: 'a-z' }, Number.MAX_SAFE_INTEGER, 0, true)
					.then((spaces) => spaces.map((s) => s.id))
					.then((spaces) => {
						res.sendStatus(204);

						RunSpacesForceload(spaces)
							.catch((err) => {
								auditLog.error('Error running force-load of spaces:', err);
							});
					}, (err) => {
						auditLog.error('Error running force-load of spaces:', err);
						res.sendStatus(500);
					});
			},
		);
}

async function RunSpacesForceload(spaces: SpaceId[]): Promise<void> {
	const logger = GetLogger('TEST').prefixMessages('[Space force-load]');
	logger.alert(`Started test force-load of spaces, ${spaces.length} to load`);

	for (let i = 0; i < spaces.length; i++) {
		if (IsStopping()) {
			logger.alert('Aborted (shutting down)');
			return;
		}

		const spaceId = spaces[i];
		logger.verbose(`Processing space ${spaceId} (${i + 1}/${spaces.length})`);

		const space = await SpaceManager.loadSpace(spaceId);
		if (space == null) {
			logger.warning(`Failed to process space ${spaceId}: Load failed`);
			continue;
		}

		const loadResult = await space.connect();
		if (typeof loadResult === 'string') {
			logger.warning(`Failed to process space ${spaceId}: ${loadResult}`);
			continue;
		}

		await Sleep(100);
		await space.cleanupIfEmpty();
	}

	logger.alert('Test force-load of spaces finishes successfully');
}
