import type { AccountRole } from 'pandora-common';
import type { ActorIdentity, ActorRoles } from './actorIdentity.ts';

class PandoraRoles implements ActorRoles {
	public isAuthorized(_role: AccountRole): boolean {
		// Pandora itself can do anything
		return true;
	}
}

export const ACTOR_PANDORA = new class PandoraActor implements ActorIdentity {
	public readonly id: number = 0;
	public readonly username: string = '[[Pandora]]';

	public readonly roles = new PandoraRoles();
};
