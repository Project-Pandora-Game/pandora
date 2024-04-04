import { Assert, AsyncSynchronized, GetLogger, type Service } from 'pandora-common';
import promClient from 'prom-client';
import { GetDatabase } from '../../database/databaseProvider';
import type { DatabaseBetaRegistration } from '../../database/databaseStructure';

const betaRegistrationTotal = new promClient.Gauge({
	name: 'pandora_directory_beta_registration_registered_total',
	help: 'Current count of total registrations for beta',
});

const betaRegistrationPending = new promClient.Gauge({
	name: 'pandora_directory_beta_registration_pending_total',
	help: 'Current count of pending registrations for beta',
});

export const BetaRegistrationService = new class BetaRegistrationService implements Service {
	private _betaRegistrations: DatabaseBetaRegistration[] | null = null;
	private readonly logger = GetLogger('BetaRegistration');

	private _getPendingRegistrations(): DatabaseBetaRegistration[] {
		Assert(this._betaRegistrations != null);

		return this._betaRegistrations.filter((r) => r.assignedKey == null);
	}

	@AsyncSynchronized('object')
	public async init(): Promise<void> {
		Assert(this._betaRegistrations == null);

		this._betaRegistrations = await GetDatabase().getConfig('betaRegistrations') ?? [];
		this.logger.info(`${this._betaRegistrations.length} registrations loaded, ${this._getPendingRegistrations().length} pending.`);
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
		this.logger.info(`Registered user ${discordId}, ${this._getPendingRegistrations().length}/${this._betaRegistrations.length} pending.`);
		await this._save();

		return 'added';
	}

	@AsyncSynchronized('object')
	public async dropCandidate(discordId: string): Promise<void> {
		Assert(this._betaRegistrations != null);
		const candidateIndex = this._betaRegistrations.findIndex((r) => r.discordId === discordId);

		// Do not drop candidates that already got key to avoid double-give in the future
		if (candidateIndex < 0 || this._betaRegistrations[candidateIndex].assignedKey != null)
			return;

		this._betaRegistrations.splice(candidateIndex, 1);
		this.logger.verbose(`Dropped candidate ${discordId}, ${this._getPendingRegistrations().length}/${this._betaRegistrations.length} pending.`);

		await this._save();
	}

	public getCandidates(count: number): Readonly<DatabaseBetaRegistration>[] {
		Assert(this._betaRegistrations != null);

		return this._betaRegistrations.filter((r) => r.assignedKey == null).slice(0, count);
	}

	@AsyncSynchronized('object')
	public async assignCandidateKey(discordId: string, key: string): Promise<boolean> {
		Assert(this._betaRegistrations != null);
		const candidate = this._betaRegistrations.find((r) => r.discordId === discordId);

		if (candidate == null || candidate.assignedKey != null)
			return false;

		candidate.assignedKey = key;
		this.logger.verbose(`Assigned key ${key} to candidate ${discordId}, ${this._getPendingRegistrations().length}/${this._betaRegistrations.length} pending.`);

		await this._save();

		return true;
	}

	private async _save(): Promise<void> {
		Assert(this._betaRegistrations != null);

		betaRegistrationPending.set(this._getPendingRegistrations().length);
		betaRegistrationTotal.set(this._betaRegistrations.length);

		await GetDatabase().setConfig('betaRegistrations', this._betaRegistrations);
	}
};
