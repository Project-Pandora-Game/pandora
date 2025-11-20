import { Assert, AsyncSynchronized, GetLogger, TimeSpanMs, type ServerService } from 'pandora-common';
import promClient from 'prom-client';
import { ACTOR_PANDORA } from '../../account/actorPandora.ts';
import { GetDatabase } from '../../database/databaseProvider.ts';
import type { DatabaseBetaRegistration } from '../../database/databaseStructure.ts';
import { BetaKeyStore } from '../../shard/betaKeyStore.ts';

const betaRegistrationActive = new promClient.Gauge({
	name: 'pandora_directory_beta_registration_active_total',
	help: 'Current count of active registrations for beta',
});

export const BETA_REGISTRATION_COOLDOWN = TimeSpanMs(7, 'days');

export const BetaRegistrationService = new class BetaRegistrationService implements ServerService {
	private _betaRegistrations: DatabaseBetaRegistration[] | null = null;
	private readonly logger = GetLogger('BetaRegistration');

	@AsyncSynchronized('object')
	public async init(): Promise<void> {
		Assert(this._betaRegistrations == null);

		this._betaRegistrations = await GetDatabase().getConfig('betaRegistrations') ?? [];
		const original = this._betaRegistrations.length;
		this._cleanupRegistrations();
		betaRegistrationActive.set(this._betaRegistrations.length);
		this.logger.info(`${original} registrations loaded, ${this._betaRegistrations.length} after cleanup.`);
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
	public async registerUser(discordId: string): Promise<{ isNew: boolean; key: string; expires: number; }> {
		Assert(this._betaRegistrations != null);

		this._cleanupRegistrations();
		const entry = this._betaRegistrations.find((r) => (r.discordId === discordId && r.assignedKey != null));
		if (entry != null && entry.assignedKey != null) {
			return {
				isNew: false,
				key: entry.assignedKey,
				expires: entry.registeredAt + BETA_REGISTRATION_COOLDOWN,
			};
		}

		// Generate a new beta key for them
		const now = Date.now();
		const expires = now + BETA_REGISTRATION_COOLDOWN;
		const key = await BetaKeyStore.create(ACTOR_PANDORA, {
			maxUses: 1,
			expires,
		});
		Assert(typeof key !== 'string');
		Assert(this._betaRegistrations != null);

		this._betaRegistrations.push({
			discordId,
			registeredAt: now,
			assignedKey: key.token,
		});
		this.logger.info(`Registered user ${discordId} with key ${key.id}`);
		await this._save();

		return {
			isNew: true,
			key: key.token,
			expires,
		};
	}

	private _cleanupRegistrations(): void {
		Assert(this._betaRegistrations != null);
		const threshold = Date.now() - BETA_REGISTRATION_COOLDOWN;

		this._betaRegistrations = this._betaRegistrations.filter((r) => {
			return r.assignedKey != null && r.registeredAt > threshold;
		});
	}

	private async _save(): Promise<void> {
		Assert(this._betaRegistrations != null);

		betaRegistrationActive.set(this._betaRegistrations.length);
		await GetDatabase().setConfig('betaRegistrations', this._betaRegistrations);
	}
};
