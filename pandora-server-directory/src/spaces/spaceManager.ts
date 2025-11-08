import { diffString } from 'json-diff';
import { isEqual, pick } from 'lodash-es';
import { AccountId, Assert, AssertNotNullable, AsyncSynchronized, GetLogger, SPACE_DIRECTORY_PROPERTIES, ServerService, SpaceActivityGetNextInterval, SpaceDirectoryConfig, SpaceDirectoryData, SpaceDirectoryDataSchema, SpaceId, type SpaceSearchArguments, type SpaceSearchResult } from 'pandora-common';
import promClient from 'prom-client';
import { Account } from '../account/account.ts';
import { accountManager } from '../account/accountManager.ts';
import { ACTOR_PANDORA } from '../account/actorPandora.ts';
import { CharacterInfo } from '../account/character.ts';
import { GetDatabase } from '../database/databaseProvider.ts';
import { ConnectionManagerClient } from '../networking/manager_client.ts';
import { Space } from './space.ts';

/** Time (in ms) after which manager prunes spaces without any activity (search or characters inside) */
export const SPACE_INACTIVITY_THRESHOLD = 60_000;
/** Time (in ms) of how often manager runs period checks */
export const TICK_INTERVAL = 15_000;

const logger = GetLogger('SpaceManager');

// TODO
// const totalSpacesMetric = new promClient.Gauge({
//     name: 'pandora_directory_spaces',
//     help: 'Total count of spaces that exist',
// });

const loadedSpacesMetric = new promClient.Gauge({
	name: 'pandora_directory_spaces_loaded',
	help: 'Current count of spaces loaded into memory',
});

const inUseSpacesMetric = new promClient.Gauge({
	name: 'pandora_directory_spaces_in_use',
	help: 'Current count of spaces in use',
});

/** Class that stores all currently or recently used spaces, removing them when needed */
export const SpaceManager = new class SpaceManagerClass implements ServerService {
	private readonly loadedSpaces: Map<SpaceId, Space> = new Map();
	/** The time of the next activity measurement interval for spaces starts */
	private _nextActivityInterval: number = 0;

	/** Init the manager */
	public init(): void {
		if (this.interval === undefined) {
			this.interval = setInterval(this.tick.bind(this), TICK_INTERVAL).unref();
		}
	}

	public onDestroy(): void {
		if (this.interval !== undefined) {
			clearInterval(this.interval);
			this.interval = undefined;
		}
		// Go through spaces and remove all of them
		for (const space of Array.from(this.loadedSpaces.values())) {
			this._unloadSpace(space);
		}
		inUseSpacesMetric.set(0);
	}

	/** A tick of the manager, happens every `ACCOUNTMANAGER_TICK_INTERVAL` ms */
	private tick(): void {
		const now = Date.now();
		const activityInterval = SpaceActivityGetNextInterval(now);

		if (activityInterval > this._nextActivityInterval) {
			const previousInterval = this._nextActivityInterval;
			// Fire off background activity interval mass update
			// This doesn't need to be synchronized at all with space's `updateActivityData`,
			// as no matter the order they get actually applied, the result should be the same.
			// (if `updateActivityData` goes first, the space is skipped by DB, if DB task goes first, it gets overwritten by `updateActivityData`)
			this._nextActivityInterval = activityInterval;
			GetDatabase().spaceMassUpdateActivityScores(activityInterval)
				.catch((err) => {
					logger.error('Error running space mass update of activity scores:', err);
					// Reset the next interval, so next tick retries this
					this._nextActivityInterval = previousInterval;
				});
		}

		let inUseCount = 0;
		// Go through spaces and prune old, inactive ones ones
		for (const space of Array.from(this.loadedSpaces.values())) {
			if (space.isInUse()) {
				inUseCount++;
				space.touch();
				space.updateActivityData(activityInterval);
			} else if (space.lastActivity + SPACE_INACTIVITY_THRESHOLD < now) {
				this._unloadSpace(space);
			}
		}
		inUseSpacesMetric.set(inUseCount);
	}

	private interval: NodeJS.Timeout | undefined;

	public async listSpacesVisibleTo(account: Account): Promise<Space[]> {
		const result = new Set<Space>();
		// Look for publically visible, currently loaded spaces
		for (const space of this.loadedSpaces.values()) {
			if (space.checkVisibleTo(account)) {
				space.touch();
				result.add(space);
			}
		}
		// Look for owned spaces or spaces this account is admin of
		for (const spaceData of await GetDatabase().getSpacesWithOwnerOrAdminOrAllowed(account.id)) {
			// Load the space (using already loaded to avoid race conditions)
			const space = this.loadedSpaces.get(spaceData.id) ?? await this._loadSpace(spaceData);
			// If we are still owner or admin, add it to the list
			if (space?.checkVisibleTo(account)) {
				result.add(space);
			}
		}
		return Array.from(result);
	}

	public async listPublicSpaces(args: SpaceSearchArguments, limit: number, skip: number): Promise<SpaceSearchResult> {
		return await GetDatabase().searchSpace(args, limit, skip, false);
	}

	/** Returns a list of spaces currently in memory */
	public listLoadedSpaces(): Space[] {
		return Array.from(this.loadedSpaces.values());
	}

	/**
	 * Find a space between **currently loaded spaces**, returning `null` if not found
	 */
	public getLoadedSpace(id: SpaceId): Space | null {
		const space = this.loadedSpaces.get(id);
		space?.touch();
		return space ?? null;
	}

	/**
	 * Find a space between loaded ones or try to load it from database
	 * @returns The space or `null` if not found even in database
	 */
	public async loadSpace(id: SpaceId): Promise<Space | null> {
		// Check if account is loaded and return it if it is
		{
			const space = this.getLoadedSpace(id);
			if (space)
				return space;
		}
		// Get it from database
		const data = await GetDatabase().getSpaceById(id, null);
		if (!data)
			return null;
		// Load the space (possible race conditions are handled in _loadSpace)
		return await this._loadSpace(data);
	}

	@AsyncSynchronized()
	public async createSpace(config: SpaceDirectoryConfig, owners: AccountId[]): Promise<Space | 'failed' | 'spaceOwnershipLimitReached'> {
		Assert(owners.length > 0, 'Space must be created with some owners');

		// Check, that owners are within limits
		for (const ownerId of owners) {
			// Meta-account Pandora has no limit
			if (ownerId === 0)
				continue;

			const owner = await accountManager.loadAccountById(ownerId);
			// We cannot have unknown owner on creation
			if (!owner)
				return 'failed';

			const ownedSpaces = await GetDatabase().getSpacesWithOwner(ownerId);

			if (ownedSpaces.length + 1 > owner.spaceOwnershipLimit)
				return 'spaceOwnershipLimitReached';
		}

		const spaceData = await GetDatabase().createSpace({
			config,
			owners,
		});
		logger.verbose(`Created space ${spaceData.id}, owned by ${spaceData.owners.join(',')}`);
		const space = await this._loadSpace(spaceData);
		AssertNotNullable(space);

		ConnectionManagerClient.onSpaceListChange();

		return space;
	}

	/** Load space from received data, adding it to loaded spaces */
	@AsyncSynchronized()
	private async _loadSpace(data: SpaceDirectoryData): Promise<Space | null> {
		{
			const existingSpace = this.loadedSpaces.get(data.id);
			if (existingSpace != null)
				return existingSpace;
		}

		const result = await SpaceDirectoryDataSchema.safeParseAsync(data);
		if (!result.success) {
			logger.error(`Failed to load space ${data.id} due to invalid data`, result.error);
			return null;
		}

		// Remove development feature if no developer owner is found
		// This is done before the equality check to also purge it from DB
		if (result.data.config.features.includes('development')) {
			let hasAuthorizedOwner = false;
			for (const owner of result.data.owners) {
				// Pandora itself can own some spaces (such as during testing), so account for that
				const account = owner === ACTOR_PANDORA.id ? ACTOR_PANDORA : await accountManager.loadAccountById(owner);
				if (account?.roles.isAuthorized('developer')) {
					hasAuthorizedOwner = true;
					break;
				}
			}
			if (!hasAuthorizedOwner) {
				result.data.config.features = result.data.config.features.filter((f) => f !== 'development');
				logger.warning(`Space [${data.id} - ${data.config.name}] had development feature enabled, but no developer owner was found. Disabling development feature.`);
			}
		}
		// Drop development data if development feature is disabled
		if (result.data.config.development != null && !result.data.config.features.includes('development')) {
			delete result.data.config.development;
		}

		{
			const validated = pick(result.data, ...SPACE_DIRECTORY_PROPERTIES);
			const original = pick(data, ...SPACE_DIRECTORY_PROPERTIES);
			if (!isEqual(validated, original)) {
				const diff = diffString(original, validated, { color: false });
				logger.warning(`Loaded space ${data.id} has invalid data, fixing...\n`, diff);
				await GetDatabase().updateSpace(data.id, validated, null);
			}
		}

		const { id } = result.data;

		// Load the space itself
		const space = new Space(result.data);

		// Load characters relevant to the space
		const characterList = await GetDatabase().getCharactersInSpace(id);

		const characters = await Promise.all(
			characterList
				.map(({ accountId, characterId }): Promise<CharacterInfo | null> => {
					return (async () => {
						const account = await accountManager.loadAccountById(accountId);
						AssertNotNullable(account);
						const character = account.characters.get(characterId);
						AssertNotNullable(character);

						account.touch();

						return character;
					})()
						.catch((err) => {
							logger.error(`Failed to load a character while loading space ${id}`, err);
							return null;
						});
				}),
		);

		// Make the space available
		Assert(!this.loadedSpaces.has(space.id));
		this.loadedSpaces.set(space.id, space);
		loadedSpacesMetric.set(this.loadedSpaces.size);

		// Assign all the characters
		for (const character of characters) {
			if (character != null) {
				character.load(space);
			}
		}

		// Request the space to update its activity
		space.updateActivityData();

		logger.debug(`Loaded space ${space.id}`);
		return space;
	}

	/** Remove space from loaded spaces, running necessary cleanup actions */
	private _unloadSpace(space: Space): void {
		logger.debug(`Unloading space ${space.id}`);
		Assert(!space.isInUse());

		// Unload all characters tracking the space
		for (const character of space.trackingCharacters) {
			character.baseInfo.trackedSpaceUnload(space);
		}
		Assert(space.trackingCharacters.size === 0);

		// Save last active time of the space
		space.updateActivityData(undefined, true);

		Assert(this.loadedSpaces.get(space.id) === space);
		this.loadedSpaces.delete(space.id);
		loadedSpacesMetric.set(this.loadedSpaces.size);
	}
};
