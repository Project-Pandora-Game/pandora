import { Assert, AsyncSynchronized, type Service } from 'pandora-common';
import { GetDatabase } from '../../database/databaseProvider';
import type { DatabaseBetaRegistration } from '../../database/databaseStructure';

export const BetaRegistrationService = new class BetaRegistrationService implements Service {
	private _betaRegistrations: DatabaseBetaRegistration[] | null = null;

	@AsyncSynchronized('object')
	public async init(): Promise<void> {
		Assert(this._betaRegistrations == null);

		this._betaRegistrations = await GetDatabase().getConfig('betaRegistrations') ?? [];
	}

	@AsyncSynchronized('object')
	public async onDestroy(): Promise<void> {
		Assert(this._betaRegistrations != null);

		// Skip save if there is nothing to save (this avoids getting stuck on timeouts if something goes wrong)
		if (this._betaRegistrations.length > 0) {
			await this._save();
		}

		this._betaRegistrations = null;
	}

	/**
	 * Adds a new user into the registration queue
	 * @param discordId - Discord ID of the user to register
	 * @returns - If the user was actually added, or `false` if they already had a pending registration
	 */
	@AsyncSynchronized('object')
	public async registerUser(discordId: string): Promise<'added' | 'pending' | 'betaAccess'> {
		Assert(this._betaRegistrations != null);

		const entry = this._betaRegistrations.find((r) => r.discordId === discordId);
		if (entry != null)
			return entry.assignedKey != null ? 'betaAccess' : 'pending';

		this._betaRegistrations.push({
			discordId,
			registeredAt: Date.now(),
			assignedKey: null,
		});
		await this._save();

		return 'added';
	}

	private async _save(): Promise<void> {
		Assert(this._betaRegistrations != null);

		await GetDatabase().setConfig('betaRegistrations', this._betaRegistrations);
	}
};
