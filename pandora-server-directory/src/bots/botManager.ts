import { diffString } from 'json-diff';
import { isEqual, omit, pick, uniq } from 'lodash-es';
import { Assert, AssertNotNullable, AsyncSynchronized, GetLogger, IsNotNullable, ServerService, type AccountId } from 'pandora-common';
import { CreateRandomBotId, type BotConfig, type BotId } from 'pandora-common/bots';
import promClient from 'prom-client';
import * as z from 'zod';
import type { Account } from '../account/account.ts';
import { GetDatabase } from '../database/databaseProvider.ts';
import { DATABASE_BOT_UPDATEABLE_PROPERTIES, DatabaseBotSchema, type DatabaseBot } from '../database/databaseStructure/bots.ts';
import { AUDIT_LOG } from '../logging.ts';
import { Bot } from './bot.ts';

/** Time (in ms) after which manager prunes bots without any active connection or space */
export const BOT_INACTIVITY_THRESHOLD = 60_000;
/** Time (in ms) of how often manager checks for bots to prune */
export const BOTMANAGER_TICK_INTERVAL = 15_000;

const logger = GetLogger('BotManager');

const loadedBotsMetric = new promClient.Gauge({
	name: 'pandora_directory_bots_loaded',
	help: 'Current count of bots loaded into memory',
});

const inUseBotsMetric = new promClient.Gauge({
	name: 'pandora_directory_bots_in_use',
	help: 'Current count of bots in use',
});

const onlineBotsMetric = new promClient.Gauge({
	name: 'pandora_directory_bots_online',
	help: 'Current count of bots considered online',
});

/** Class that stores all currently connected or recently used bots, removing them when needed */
export class BotManager implements ServerService {
	private readonly _onlineBots: Set<Bot> = new Set();

	public getOnlineCounts(): {
		inUseBots: number;
		onlineBots: number;
	} {
		let inUseBots = 0;
		let onlineBots = 0;
		for (const bot of this._onlineBots) {
			if (bot.isInUse()) {
				inUseBots++;
			}
			if (bot.isOnline()) {
				onlineBots++;
			}
		}
		return { inUseBots, onlineBots };
	}

	/** A tick of the manager, happens every `BOTMANAGER_TICK_INTERVAL` ms or when requested */
	public tick(): void {
		const now = Date.now();
		// Go through bots and prune old ones
		for (const bot of this._onlineBots) {
			if (!bot.isInUse() && (
				bot.lastActivity + BOT_INACTIVITY_THRESHOLD < now ||
				!bot.isValid
			)) {
				this.unloadBot(bot);
			}
		}

		// Update metrics
		const { inUseBots, onlineBots } = this.getOnlineCounts();
		inUseBotsMetric.set(inUseBots);
		onlineBotsMetric.set(onlineBots);
	}

	private interval: NodeJS.Timeout | undefined;

	/** Init the manager */
	public init(): void {
		if (this.interval === undefined) {
			this.interval = setInterval(this.tick.bind(this), BOTMANAGER_TICK_INTERVAL).unref();
		}
	}

	public onDestroy(): void {
		if (this.interval !== undefined) {
			clearInterval(this.interval);
			this.interval = undefined;
		}
		// Go through bots and remove all of them
		for (const bot of this._onlineBots) {
			this.unloadBot(bot);
		}
		inUseBotsMetric.set(0);
		onlineBotsMetric.set(0);
	}

	/** Create bot from received data, adding it to loaded bots */
	@AsyncSynchronized()
	private async _loadBot(rawData: DatabaseBot): Promise<Bot | null> {
		// If there already is bot matching this id loaded, simply return it
		const loadedBot = this.getBotById(rawData.id);
		if (loadedBot) {
			return loadedBot.isValid ? loadedBot : null;
		}

		// Verify and migrate bot data
		rawData = omit(rawData, '_id');
		const parsedData = DatabaseBotSchema.safeParse(rawData);
		if (!parsedData.success) {
			logger.error(`Failed to load bot "${rawData.id}":\n`, z.prettifyError(parsedData.error));
			return null;
		}
		// Save data modified by migration and catches
		if (!isEqual(parsedData.data, rawData)) {
			const diff = diffString(rawData, parsedData.data, { color: false });
			logger.warning(`Bot ${parsedData.data.id} has invalid data, fixing...\n`, diff);
			await GetDatabase().updateBotData(parsedData.data.id, pick(parsedData.data, ...DATABASE_BOT_UPDATEABLE_PROPERTIES));
		}

		const bot = new Bot(parsedData.data);
		this._onlineBots.add(bot);
		loadedBotsMetric.set(this._onlineBots.size);
		logger.debug(`Loaded bot "${bot.id}"`);
		return bot;
	}

	/** Remove bot from loaded bots, running necessary cleanup actions */
	private unloadBot(bot: Bot): void {
		Assert(!bot.isInUse());
		logger.debug(`Unloading bot "${bot.id}"`);
		bot.onUnload();
		this._onlineBots.delete(bot);
		loadedBotsMetric.set(this._onlineBots.size);
	}

	/**
	 * Find a bot between **currently loaded bots**, returning `null` if not found
	 */
	public getBotById(id: BotId): Bot | null {
		for (const bot of this._onlineBots) {
			if (bot.id === id && bot.isValid) {
				bot.touch();
				return bot;
			}
		}
		return null;
	}

	/**
	 * Find a bot between loaded ones or try to load it from database
	 * @returns The bot or `null` if not found even in database
	 */
	public async loadBotById(id: BotId): Promise<Bot | null> {
		// Check if account is loaded and return it if it is
		const bot = this.getBotById(id);
		if (bot) {
			return bot;
		}
		// Get it from database
		const data = await GetDatabase().getBotById(id);
		// Use the acquired DB data to load the bot
		if (!data)
			return null;
		return await this._loadBot(data);
	}

	/**
	 * Find all bot owned by specified account
	 */
	public async loadAllBotsOwnedBy(id: AccountId): Promise<Bot[]> {
		// Get full list from database
		const data = await GetDatabase().getBotsOwnedBy(id);
		// Use the acquired DB data to load the bots
		const result = await Promise.all(data.map((bot) => this._loadBot(bot)));
		return result.filter(IsNotNullable);
	}

	public async createBot(config: BotConfig, owner: Account): Promise<Bot | 'notAllowed' | 'failed'> {
		if (!owner.roles.isAuthorized('bot-developer')) {
			AUDIT_LOG.warning(`Account ${owner.id} attempted to create bot without being authorized`);
			return 'notAllowed';
		}

		const now = Date.now();

		const botData: DatabaseBot = {
			id: CreateRandomBotId(),
			name: config.name,
			description: config.description,
			ownerAccount: owner.id,
			requestedPermissions: uniq(config.requestedPermissions),
			private: config.private,
			created: now,
			updated: now,
			lastUse: null,
		};

		const data = await GetDatabase().createBot(botData);
		if (data === 'duplicateId')
			return 'failed'; // Unicorn

		AUDIT_LOG.info(`Registered new bot. id="${data.id}" owner=${owner.id}`);
		const bot = await this._loadBot(data);
		AssertNotNullable(bot);

		return bot;
	}
}

/** Manager of all currently connected or recently used bots */
export const botManager = new BotManager();
