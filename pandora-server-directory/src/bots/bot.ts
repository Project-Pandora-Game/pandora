import { cloneDeep, uniq } from 'lodash-es';
import {
	Assert,
	AsyncSynchronized,
	GetLogger,
	ServerRoom,
	TypedEventEmitter,
	type AccountId,
	type HexColorString,
	type IChatMessageActionBot,
	type Logger,
	type ManagementBotInfo,
} from 'pandora-common';
import type { BotConfig, BotDefinition, BotId } from 'pandora-common/bots';
import type { IDirectoryApi } from 'pandora-common/networking/api/directory_api';
import { GetDatabase } from '../database/databaseProvider.ts';
import type { DatabaseBot, DatabaseBotUpdate } from '../database/databaseStructure/bots.ts';
import type { ApiConnection } from '../networking/api/socket/connection_api.ts';
import { botManager } from './botManager.ts';

/** Color for any bot name or message. */
export const DEFAULT_BOT_COLOR: HexColorString = '#cccccc';

/** Defined bot account. */
export class Bot extends TypedEventEmitter<{
	/** Some of the bots's information has changed. Re-check important data the consumer uses. */
	botInfoChanged: void;
}> {
	private readonly logger: Logger;

	/** Time when this bot was last used */
	public lastActivity: number;
	/** The bot's saved data */
	private data: DatabaseBot;

	/** List of API connections listening to bot change events */
	public readonly associatedApiConnections = new ServerRoom<IDirectoryApi, ApiConnection>();

	private _deletionPending = false;

	public get id(): BotId {
		return this.data.id;
	}

	public get displayName(): string {
		return this.data.name;
	}

	public get ownerAccount(): AccountId {
		return this.data.ownerAccount;
	}

	public get isValid(): boolean {
		return !this._deletionPending;
	}

	public get isPublic(): boolean {
		return !this.data.private;
	}

	constructor(data: DatabaseBot) {
		super();
		this.logger = GetLogger('Bot', `[Bot ${data.id}]`);
		this.lastActivity = Date.now();
		this.data = data;
	}

	public onUnload(): void {
		// Nothing here yet
	}

	/** Update last activity timestamp to reflect last usage */
	public touch(): void {
		this.lastActivity = Date.now();
	}

	public isInUse(): boolean {
		return this.associatedApiConnections.hasClients();
	}

	public isOnline(): boolean {
		return this.associatedApiConnections.hasClients();
	}

	/** Build account part of `connectionState` update message for connection */
	public getPublicDefinition(): BotDefinition {
		return {
			id: this.data.id,
			name: this.data.name,
			description: this.data.description,
			ownerAccount: this.data.ownerAccount,
			requestedPermissions: this.data.requestedPermissions.slice(),
			private: this.data.private,
		};
	}

	public getChatDescriptor(): IChatMessageActionBot {
		return {
			type: 'bot',
			id: this.id,
			displayName: this.displayName,
			labelColor: DEFAULT_BOT_COLOR,
		};
	}

	public getAdminInfo(): Readonly<ManagementBotInfo> {
		return cloneDeep<ManagementBotInfo>({
			...this.getPublicDefinition(),
			created: this.data.created,
			updated: this.data.updated,
			lastUse: this.data.lastUse,
			online: this.isOnline(),
		});
	}

	@AsyncSynchronized('object')
	public async updateConfig(config: Partial<BotConfig>): Promise<'ok' | 'failed'> {
		// Bail out if space is invalidated
		if (!this.isValid)
			return 'failed';

		const db = GetDatabase();
		const update: DatabaseBotUpdate = {};

		if (config.name != null) {
			this.data.name = update.name = config.name;
		}
		if (config.description != null) {
			this.data.description = update.description = config.description;
		}
		if (config.requestedPermissions != null) {
			this.data.requestedPermissions = uniq(config.requestedPermissions);
			update.requestedPermissions = cloneDeep(this.data.requestedPermissions);
		}
		if (config.private != null) {
			this.data.private = update.private = config.private;
		}

		await db.updateBotData(this.id, update);
		this.onBotInfoChange();

		return 'ok';
	}

	/**
	 * Mark this bot for deletion and delete it from the database.
	 * This removes it from all loaded spaces and any space that loads in the future will remove it lazily when it is not found
	 */
	@AsyncSynchronized('object')
	public async delete(): Promise<void> {
		this._deletionPending = true;
		this.logger.info('Deleted');
		// Finally delete the bot from the database
		await GetDatabase().deleteBot(this.id);
		// And unload it from manager
		queueMicrotask(() => {
			botManager.tick();
		});
	}

	// eslint-disable-next-line @typescript-eslint/require-await
	public async onManagerDestroy(): Promise<void> {
		// Disconnect bot API connections
		for (const client of this.associatedApiConnections.clients.slice()) {
			client.removeBotRegistration(this);
		}
		Assert(!this.associatedApiConnections.hasClients());
	}

	public onBotInfoChange(): void {
		// Update anything else that subscribed
		this.emit('botInfoChanged', undefined);
	}
}
