import { isEqual, last, uniq } from 'lodash-es';
import { Assert, AsyncSynchronized, CharacterId, CloneDeepMutable, CreateManuallyResolvedPromise, GetLogger, IDirectoryShardInfo, IDirectoryShardUpdate, IShardCharacterDefinition, IShardDirectoryArgument, IShardDirectoryPromiseResult, IShardSpaceDefinition, IShardTokenType, IsNotNullable, Logger, ManuallyResolvedPromise, SpaceId, type ChatMessageDirectoryAction } from 'pandora-common';
import type { Account } from '../account/account.ts';
import { accountManager } from '../account/accountManager.ts';
import { Character } from '../account/character.ts';
import { IConnectionShard } from '../networking/common.ts';
import { ConnectionManagerClient } from '../networking/manager_client.ts';
import type { Space } from '../spaces/space.ts';
import { SpaceManager } from '../spaces/spaceManager.ts';
import { Sleep } from '../utility.ts';
import { SHARD_TIMEOUT, ShardManager } from './shardManager.ts';
import type { IConnectedTokenInfo } from './shardTokenStore.ts';

export class Shard {
	public readonly id;
	public readonly type: IShardTokenType;
	public shardConnection: IConnectionShard | null = null;
	private timeout: NodeJS.Timeout | null = null;

	private _registered: boolean = false;
	public get registered(): boolean {
		return this._registered;
	}
	private stopping: boolean = false;
	private reconnecting: boolean = false;

	private publicURL = '';
	private features: IDirectoryShardInfo['features'] = [];
	private version = '';

	private logger: Logger;

	constructor({ id, type }: Readonly<IConnectedTokenInfo>) {
		this.id = id;
		this.type = type;
		this.logger = GetLogger('Shard', `[Shard ${this.id}]`);
	}

	public allowConnect(): boolean {
		return this.registered && !this.stopping;
	}

	/** Map of character ids to characters */
	public readonly characters: Map<CharacterId, Character> = new Map();

	/** Map of space ids to spaces */
	public readonly spaces: Map<SpaceId, Space> = new Map();

	public getConnectedCharacter(id: CharacterId): Character | undefined {
		return this.characters.get(id);
	}

	public getConnectedSpace(id: SpaceId): Space | undefined {
		return this.spaces.get(id);
	}

	public async handleReconnect(data: IShardDirectoryArgument['shardRegister'], connection: IConnectionShard): IShardDirectoryPromiseResult['shardRegister'] {
		// Invalidate current connection (when shard reconnects quicker than old connection times out)
		if (this.shardConnection) {
			this.setConnection(null);
		}

		this.reconnecting = true;

		Assert(this.publicURL === data.publicURL, `Shard's publicURL cannot change`);
		Assert(isEqual(this.features, data.features), `Shard's features cannot change`);
		Assert(this.version === data.version, `Shard's version cannot change`);

		// Characters and spaces from shard are ignored, Directory is source of truth on reconnect

		// Remove characters that should be connected but are not anymore
		await Promise.all(
			data.disconnectCharacters
				.map((id) => this.getConnectedCharacter(id)?.disconnect())
				.filter(IsNotNullable),
		);

		this.setConnection(connection);
		this.logger.info('Reconnected');
		ConnectionManagerClient.onShardListChange();

		// If anyone is waiting for update, resolve it after sending data back
		if (this.updatePending != null) {
			const update = this.updatePending;
			this.updatePending = null;
			this.updateReasons.clear();
			setTimeout(() => {
				update.resolve();
			}, 100);
		}

		return {
			shardId: this.id,
			characters: this.makeCharacterSetupList(),
			spaces: this.makeSpacesSetupList(),
			messages: this.makeDirectoryActionMessages(),
		};
	}

	public async register(data: IShardDirectoryArgument['shardRegister'], connection: IConnectionShard): IShardDirectoryPromiseResult['shardRegister'] {
		if (this._registered) {
			throw new Error('Cannot re-register shard');
		}

		this.reconnecting = true;

		this.publicURL = data.publicURL;
		this.features = data.features;
		this.version = data.version;

		const accounts = new Map<number, Account>();
		await Promise.all(
			uniq(data.characters.map((c) => c.account.id))
				.map((id) => accountManager
					.loadAccountById(id)
					.then((account) => {
						if (account) {
							accounts.set(account.data.id, account);
						}
					}),
				),
		);

		// We should have no requests for the shard before it registered
		Assert(this.updatePending == null);

		this._registered = true;

		// Space ids should be unique in received data
		Assert(uniq(data.spaces.map((s) => s.id)).length === data.spaces.length);

		await Promise.all(
			data.spaces.map((spaceData) => SpaceManager
				.loadSpace(spaceData.id)
				.then((space) => {
					if (!space)
						return;

					const characterAccessIds = new Map<CharacterId, string>();
					for (const character of data.characters) {
						if (character.space === space.id) {
							characterAccessIds.set(character.id, character.accessId);
						}
					}

					return space.shardReconnect(this, spaceData.accessId, characterAccessIds);
				}),
			),
		);

		for (const characterData of data.characters) {
			// Skip characters that should be disconnected anyway
			if (data.disconnectCharacters.includes(characterData.id))
				continue;
			const account = accounts.get(characterData.account.id);
			const character = account?.characters.get(characterData.id);

			if (!character) {
				// Do not load in character that loaded elsewhere meanwhile
				continue;
			}

			const space = characterData.space ? this.spaces.get(characterData.space) : undefined;

			await character.shardReconnect({
				shard: this,
				accessId: characterData.accessId,
				connectionSecret: characterData.connectSecret,
				space: space ?? null,
			});

			this.logger.debug('Added character during registration', character.id);
		}

		for (const space of this.spaces.values()) {
			await space.cleanupIfEmpty();
		}

		this.setConnection(connection);
		this.logger.info('Registered');
		ConnectionManagerClient.onShardListChange();

		return {
			shardId: this.id,
			characters: this.makeCharacterSetupList(),
			spaces: this.makeSpacesSetupList(),
			messages: this.makeDirectoryActionMessages(),
		};
	}

	public async handleCharacterClientDisconnect(id: CharacterId): Promise<void> {
		const character = this.getConnectedCharacter(id);
		if (!character) {
			this.logger.warning(`Received request to disconnect client ${id} that is not assigned to this shard`);
			this.update('characters')
				.catch((e) => {
					this.logger.warning(`Error sending update:`, e);
				});
			return;
		}

		await character.disconnect();
	}

	public setConnection(connection: IConnectionShard | null): void {
		this.reconnecting = false;
		if (this.timeout !== null) {
			clearTimeout(this.timeout);
			this.timeout = null;
		}
		if (this.shardConnection && this.shardConnection !== connection) {
			// TODO
			// this.shardConnection.disconnect();
			this.shardConnection.shard = null;
			this.shardConnection = null;
		}
		if (connection) {
			connection.shard = this;
			this.shardConnection = connection;
		} else {
			// Do not trigger timeout if we are already stopping
			if (!this.stopping) {
				this.timeout = setTimeout(this.handleTimeout.bind(this), SHARD_TIMEOUT);
			}
		}
	}

	private handleTimeout(): void {
		this.logger.info('Timed out');
		this.stopping = true;
		ConnectionManagerClient.onShardListChange();
		Assert(this.shardConnection == null);
		ShardManager.deleteShard(this.id)
			.catch((err) => {
				this.logger.fatal('Failed to delete timed-out shard', err);
			});
	}

	public async stop(): Promise<void> {
		this.logger.info('Stop issued');
		this.stopping = true;
		ConnectionManagerClient.onShardListChange();
		if (this.shardConnection) {
			this.logger.debug('Requesting clean stop from shard');
			await this.shardConnection.awaitResponse('stop', {})
				.then(() => {
					this.logger.debug('Shard reported successful stop');
				}, (err) => {
					this.logger.warning('Shard stop error', err);
				});
			this.setConnection(null);
		}
		ShardManager.deleteShard(this.id)
			.catch((err) => {
				this.logger.fatal('Failed to delete stopping shard', err);
			});
	}

	public async onDelete(attemptReassign: boolean): Promise<void> {
		this.stopping = true;
		this.setConnection(null);

		// Force-reject any pending updates that were scheduled before shard's stop
		if (this.updatePending) {
			const update = this.updatePending;
			this.updatePending = null;
			update.reject('Shard deleted');
		}

		// Development shards wait for another shard to be present before reassign (for up to 60 seconds)
		if (attemptReassign && this.features.includes('development')) {
			const end = Date.now() + 60_000;
			while (Date.now() < end && ShardManager.listShads().length === 0 && !ShardManager.stopping) {
				this.logger.verbose('Waiting for another shard before migrating...');
				await Sleep(5_000);
			}
		}

		// Reassign spaces
		await Promise.all(
			[...this.spaces.values()]
				.map(async (space) => {
					await space.disconnect();
					if (attemptReassign) {
						await space.connect();
					}
				}),
		);
		// Reassign characters
		await Promise.all(
			[...this.characters.values()]
				.map(async (character) => {
					await character.shardChange(attemptReassign);
				}),
		);
		this.logger.info('Deleted');
	}

	public getInfo(): IDirectoryShardInfo {
		return ({
			id: this.id,
			publicURL: this.publicURL,
			features: this.features,
			version: this.version,
		});
	}

	private updateReasons = new Set<keyof IDirectoryShardUpdate>();
	private updatePending: ManuallyResolvedPromise<void> | null = null;

	public update(...reasons: (keyof IDirectoryShardUpdate | null)[]): Promise<void> {
		Assert(this._registered);
		if (this.stopping)
			return Promise.resolve();

		for (const r of reasons) {
			if (r != null) {
				this.updateReasons.add(r);
			}
		}
		if (this.updatePending == null) {
			this.updatePending = CreateManuallyResolvedPromise();
			setTimeout(() => {
				const update = this.updatePending;
				// If someone resolved the update meanwhile, do nothing
				if (update == null)
					return;

				this.updatePending = null;
				this._sendUpdate()
					.then((result) => {
						if (result) {
							update.resolve();
						} else {
							// If update failed, requeue it
							if (this.updatePending == null) {
								this.updatePending = update;
							} else {
								this.updatePending.promise.then(update.resolve, update.reject);
							}
						}
					}, (error) => {
						this.logger.fatal('Error while running sendUpdate:', error);
						update.reject(new Error('Update failed', { cause: error }));
					});
			}, 100);
		}

		return this.updatePending.promise;
	}

	@AsyncSynchronized()
	private async _sendUpdate(): Promise<boolean> {
		if (this.stopping || this.reconnecting || this.updateReasons.size === 0)
			return true;
		if (!this.shardConnection)
			return false;

		const update: Partial<IDirectoryShardUpdate> = {};
		const updateReasons = Array.from(this.updateReasons);
		this.updateReasons.clear();

		if (updateReasons.includes('characters')) {
			update.characters = this.makeCharacterSetupList();
		}
		if (updateReasons.includes('spaces')) {
			update.spaces = this.makeSpacesSetupList();
		}
		if (updateReasons.includes('messages')) {
			update.messages = this.makeDirectoryActionMessages();
		}

		try {
			await this.shardConnection.awaitResponse('update', update, 10_000);
			// Cleanup pending messages
			if (update.messages) {
				for (const space of this.spaces.values()) {
					if (!update.messages[space.id])
						continue;
					const lastMessage = last(update.messages[space.id]);
					if (lastMessage !== undefined) {
						const index = space.pendingMessages.indexOf(lastMessage);
						if (index >= 0) {
							space.pendingMessages.splice(0, index + 1);
						}
					}
				}
			}
		} catch (error) {
			this.logger.warning('Failed to update shard:', error);
			updateReasons.forEach((r) => this.updateReasons.add(r));
			return false;
		}
		return true;
	}

	private makeCharacterSetupList(): IShardCharacterDefinition[] {
		const result: IShardCharacterDefinition[] = [];
		for (const [id, character] of this.characters) {
			result.push({
				id,
				account: character.baseInfo.account.getShardAccountDefinition(),
				accessId: character.accessId,
				connectSecret: character.connectSecret,
				space: character.space ? character.space.id : null,
			});
		}
		return result;
	}

	private makeSpacesSetupList(): IShardSpaceDefinition[] {
		return Array.from(this.spaces.values()).map((s) => ({
			id: s.id,
			accessId: s.accessId,
			config: s.getConfig(),
			owners: Array.from(s.owners),
			ownerInvites: Array.from(s.ownerInvites),
			spaceSwitchStatus: CloneDeepMutable(s.spaceSwitchStatus),
		}));
	}

	private makeDirectoryActionMessages(): Record<SpaceId, ChatMessageDirectoryAction[]> {
		const result: Record<SpaceId, ChatMessageDirectoryAction[]> = {};
		for (const space of this.spaces.values()) {
			if (space.pendingMessages.length > 0) {
				result[space.id] = space.pendingMessages.slice();
			}
		}
		return result;
	}
}
