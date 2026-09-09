import { Immutable } from 'immer';
import {
	Assert,
	CalculateObjectKeysDelta,
	GetLogger,
	Logger,
	type BotPrivateData,
	type BotPublicData,
} from 'pandora-common';
import type { BotId } from 'pandora-common/bots';
import type { ShardSpaceBotState } from 'pandora-common/networking/api/directory_shard';
import type { BotConnection } from '../networking/bot/connection_bot.ts';
import type { Space } from './space.ts';

/** Time (in ms) after which directory is notified that the space's bot is disconnected */
export const SPACE_BOT_TIMEOUT = 30_000;

export class SpaceBot {
	private _state: ShardSpaceBotState;
	public readonly space: Space;

	private invalid: null | 'remove' = null;

	/** Timeout (interval) for when directory should be notified that client is disconnected */
	private _clientTimeout: NodeJS.Timeout | null = null;

	private _connection: BotConnection | null = null;
	public get connection(): BotConnection | null {
		return this._connection;
	}

	public get id(): BotId {
		return this._state.bot;
	}

	public get state(): Immutable<ShardSpaceBotState> {
		return this._state;
	}

	public get isValid(): boolean {
		return this.invalid === null;
	}

	private readonly logger: Logger;

	constructor(space: Space, state: ShardSpaceBotState) {
		this.logger = GetLogger('SpaceBot', `[SpaceBot ${state.bot}(${space.id})]`);
		this._state = state;

		this.setConnection(null);

		// Load into the space
		Assert(this.isValid, 'Bot state should not load while invalid');

		// Send update to current characters
		space.sendUpdateToAllCharacters({
			bot: this.getPublicData(),
		});
		// No need to send update to the bot, as it isn't connected yet
		this.space = space;
	}

	public update(state: ShardSpaceBotState) {
		Assert(this.isValid);
		if (state.bot !== this._state.bot) {
			throw new Error('Bot update changes id');
		}
		if (state.connectSecret !== this._state.connectSecret) {
			throw new Error('Bot update changes secret'); // This should re-create the space bot
		}
		const oldData = this.getPublicData();
		this._state = state;

		const publicDataUpdate = CalculateObjectKeysDelta(oldData, this.getPublicData());
		if (publicDataUpdate != null) {
			this._sendDataUpdate(publicDataUpdate);
		}
	}

	public isInUse(): boolean {
		return this.connection !== undefined;
	}

	public setConnection(connection: BotConnection | null): void {
		if (this._connection != null) {
			Assert(this._connection !== connection);
			this.logger.debug(`Disconnected (${this._connection.id})`);
			this._connection.disconnect('Replaced by new connection');
			Assert(this._connection == null);
		}
		Assert(!this.invalid);
		if (this._clientTimeout !== null) {
			clearInterval(this._clientTimeout);
			this._clientTimeout = null;
		}
		if (connection) {
			this.logger.debug(`Connected (${connection.id})`);
			this._connection = connection;
		} else if (this.isValid) {
			this._clientTimeout = setInterval(this._handleTimeout.bind(this), SPACE_BOT_TIMEOUT);
		}
	}

	private _handleTimeout(): void {
		if (!this.isValid)
			return;
		this.logger.verbose('Bot timed out');
		// TODO: Handle bot timeouts
		// DirectoryConnector.sendMessage('characterClientDisconnect', { id: this.id, reason: 'timeout' });
	}

	public onRemove(): void {
		Assert(this.space.bot == null);

		this.invalidate('remove');

		// Update everyone in the space
		this.space.sendUpdateToAllCharacters({
			bot: null,
		});
	}

	private invalidate(reason: 'remove'): void {
		if (this.invalid !== null)
			return;
		this.invalid = reason;

		if (this._connection != null) {
			this.logger.debug(`Disconnected during invalidation (${this._connection.id})`);
			this._connection.disconnect('Bot invalidated: ' + reason);
			Assert(this._connection == null);
		}
		if (this._clientTimeout !== null) {
			clearInterval(this._clientTimeout);
			this._clientTimeout = null;
		}
	}

	public getPublicData(): BotPublicData {
		return {
			bot: this.state.bot,
		};
	}

	public getPrivateData(): BotPrivateData {
		return {
			...this.getPublicData(),
		};
	}

	private _sendDataUpdate(_updatedData: Partial<BotPublicData>): void {
		this.space.sendUpdateToAllCharacters({
			bot: this.getPublicData(), // TODO: Figure out how to do delta updates here
		});
	}

	private _sendPrivateDataUpdate(updatedData: Partial<Omit<BotPrivateData, keyof BotPublicData>>): void {
		this.connection?.sendMessage('updateBotPrivateData', updatedData);
	}
}
