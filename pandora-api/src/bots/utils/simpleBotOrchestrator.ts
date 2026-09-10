import { type Promisable, type SpaceId, AsyncSynchronized, GetLogger } from 'pandora-common';
import { type BotDirectoryStateInfo, type BotId, type BotShardConnectionInfo, type BotSpaceStateInfo } from 'pandora-common/bots';
import type { PandoraApi } from '../../api/pandoraApi.ts';
import { URL } from '../../internal/utils/url_shim.ts';

/**
 * Abstract interface for a bot created by Simple Bot Orchestrator.
 */
export interface SimpleBotOrchestratorBotInstance {
	/**
	 * Disconnect from the shard and clean up resources.
	 */
	disconnect(): Promisable<void>;

	/**
	 * Optional: If the instance supports live changing of connection info, then update it and reconnect.
	 *
	 * If this method is not specified, then the instance is re-created when info changes.
	 */
	updateConnectionInfo?(newConnectionInfo: BotShardConnectionInfo): Promisable<void>;
}

/**
 * Factory function that creates a BotConnection from shard connection info.
 */
export type SimpleBotOrchestratorBotFactory = (bot: BotId, space: SpaceId, connectionInfo: BotShardConnectionInfo) => Promisable<SimpleBotOrchestratorBotInstance>;

/**
 * A simple bot orchestrator - the little piece that creates bot connection for each space assigned to the registered bot.
 */
export class SimpleBotOrchestrator {
	public readonly api: PandoraApi;
	public readonly bot: BotId;
	public readonly factory: SimpleBotOrchestratorBotFactory;
	public readonly baseUrl: string;

	private _connections = new Map<SpaceId, [connectionInfo: BotShardConnectionInfo, instance: SimpleBotOrchestratorBotInstance]>();
	private _stateSnapshot: BotDirectoryStateInfo | null = null;

	private readonly logger = GetLogger('SimpleBotOrchestrator');
	private _running = false;
	private _unsubscribeBotStateChanged: (() => void) | null = null;
	private _unsubscribeConnected: (() => void) | null = null;

	constructor(
		api: PandoraApi,
		bot: BotId,
		factory: SimpleBotOrchestratorBotFactory,
		baseUrl: string,
	) {
		this.api = api;
		this.bot = bot;
		this.factory = factory;
		this.baseUrl = baseUrl;
		// Check base URL parsing
		new URL(this.baseUrl);
	}

	@AsyncSynchronized('object')
	public async start(): Promise<void> {
		if (this._running)
			throw new Error('Already running');

		// Subscribe to bot state changes
		this._unsubscribeBotStateChanged = this.api.bots.onBotStateChanged((data) => {
			if (data.bot === this.bot) {
				this._stateSnapshot = data.state;
				this._applyState()
					.catch((err) => {
						this.logger.error('Error applying state:', err);
					});
			}
		});

		this._unsubscribeConnected = this.api.on('connected', () => {
			(async () => {
				(await this.api.bots.botRunRegister(this.bot))
					.expect('Failed to register bot');

				this.logger.verbose('Re-registered bot after Directory reconnect');
			})()
				.catch((err) => {
					this.logger.error('Error while re-registering bot after Directory reconnect:', err);
				});
		});

		// Register bot with directory server
		// TODO: Handle server reconnects... somehow
		(await this.api.bots.botRunRegister(this.bot))
			.expect('Failed to register bot');

		this._running = true;

		// Apply initial state if already available (can race with completion of `botRunRegister`)
		if (this._stateSnapshot != null) {
			this._applyState()
				.catch((err) => {
					this.logger.error('Error applying initial state after start:', err);
				});
		}
	}

	@AsyncSynchronized('object')
	public async stop(): Promise<void> {
		if (!this._running)
			throw new Error('Not running');

		this._running = false;

		// Unsubscribe from state changes
		this._unsubscribeBotStateChanged?.();
		this._unsubscribeBotStateChanged = null;
		this._unsubscribeConnected?.();
		this._unsubscribeConnected = null;
		this._stateSnapshot = null;

		// Unregister bot from directory server
		(await this.api.bots.botRunUnregister(this.bot))
			.map_err((err) => {
				this.logger.error('Error unregistering from directory on stop:', err);
			});

		// Disconnect all active connections
		await Promise.all([...this._connections.values()].map(async (c) => await c[1].disconnect()));
		this._connections.clear();
	}

	/**
	 * Core diff-and-sync logic: compare state snapshot with active connections,
	 * spawn or disconnect as needed.
	 */
	@AsyncSynchronized('object')
	private async _applyState(): Promise<void> {
		if (this._stateSnapshot == null || !this._running)
			return;

		const { spaces } = this._stateSnapshot;

		// Process each space in the snapshot
		for (const spaceState of spaces) {
			await this._handleSpace(spaceState);
		}

		// Disconnect any remaining connection whose space is no longer in the snapshot
		for (const spaceId of Array.from(this._connections.keys())) {
			if (!spaces.some((s) => s.id === spaceId)) {
				await this._disconnectSpace(spaceId);
			}
		}
	}

	/**
	 * Handle a single space from the state snapshot.
	 */
	private async _handleSpace(spaceState: BotSpaceStateInfo): Promise<void> {
		const { id: spaceId, connection: connectionInfo } = spaceState;

		if (connectionInfo != null) {
			// Space is ready to connect to - ensure we are
			const currentConnection = this._connections.get(spaceId);
			if (currentConnection != null) {
				if (currentConnection[0].connectUrl === connectionInfo.connectUrl && currentConnection[0].secret === connectionInfo.secret)
					return;

				if (typeof currentConnection[1].updateConnectionInfo === 'function') {
					try {
						await currentConnection[1].updateConnectionInfo(this._resolveConnectionInfo(connectionInfo));
						currentConnection[0] = connectionInfo;
						return;
					} catch (err) {
						this.logger.error(`Failed to update connection info for space ${spaceId}, doing reconnect instead:`, err);
						await this._disconnectSpace(spaceId);
					}
				}
			}

			// Spawn a new connection
			try {
				const connection = await this.factory(this.bot, spaceId, this._resolveConnectionInfo(connectionInfo));
				this._connections.set(spaceId, [connectionInfo, connection]);
			} catch (err) {
				this.logger.error(`Failed to create connection for space ${spaceId}:`, err);
			}
		} else {
			// Space is not connectable - disconnect if we have a connection
			const existingConnection = this._connections.get(spaceId);
			if (existingConnection) {
				await this._disconnectSpace(spaceId);
			}
		}
	}

	/**
	 * Disconnect and remove a space connection.
	 */
	private async _disconnectSpace(spaceId: SpaceId): Promise<void> {
		const connection = this._connections.get(spaceId);
		if (connection == null)
			return;

		this._connections.delete(spaceId);
		try {
			await connection[1].disconnect();
		} catch (err) {
			this.logger.error(`Error while disconnecting from space ${spaceId}:`, err);
		}
	}

	/** Updates connection info to be usable by connection directly. */
	private _resolveConnectionInfo(connectionInfo: BotShardConnectionInfo): BotShardConnectionInfo {
		return {
			connectUrl: connectionInfo.connectUrl.split(';')
				.map((it) => {
					// For relative URLs, we need to map them relative to the Directory address
					if (it.startsWith('/')) {
						it = new URL(it, this.baseUrl).href;
					}
					return it;
				})
				.join(';'),
			secret: connectionInfo.secret,
		};
	}
}
