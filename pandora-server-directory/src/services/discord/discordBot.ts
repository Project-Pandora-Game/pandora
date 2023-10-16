import Discord, { BitFieldResolvable, GatewayIntentsString, GuildChannel } from 'discord.js';
import _ from 'lodash';
import { GetLogger, Service } from 'pandora-common';
import { ENV } from '../../config';
const { DISCORD_BOT_TOKEN, DISCORD_BOT_ACCOUNT_STATUS_CHANNEL_ID, DISCORD_BOT_CHARACTER_STATUS_CHANNEL_ID } = ENV;

const STATUS_THROTTLE_TIME = 10 * 60 * 1000; // 10 minutes

const GATEWAY_INTENTS: BitFieldResolvable<GatewayIntentsString, number> = [
	'Guilds',
	'GuildIntegrations',
];

const logger = GetLogger('DiscordBot');

type Status<T> = {
	accounts: T;
	characters: T;
};

export type DiscordBotStatus = Status<number>;

export const DiscordBot = new class DiscordBot implements Service {
	private _client?: Discord.Client;
	private _statusChannels?: Partial<Status<GuildChannel>>;
	private _destroyed = false;

	public async init(): Promise<this> {
		if (!DISCORD_BOT_TOKEN) {
			logger.warning('Secret is not set, Discord Bot is disabled', DISCORD_BOT_TOKEN);
			return this;
		}

		this._client = new Discord.Client({
			intents: GATEWAY_INTENTS,
		});

		const result = await this._client.login(DISCORD_BOT_TOKEN);
		if (result !== DISCORD_BOT_TOKEN) {
			logger.error('Discord login failed');
			return this;
		}

		/** Call with no status to trigger throttle */
		this.setOnlineStatus({});

		this._statusChannels = {
			accounts: await this._getGuildChannel(DISCORD_BOT_ACCOUNT_STATUS_CHANNEL_ID),
			characters: await this._getGuildChannel(DISCORD_BOT_CHARACTER_STATUS_CHANNEL_ID),
		};

		this._client.user?.setStatus('online');

		logger.info('Discord Bot is ready');

		return this;
	}

	public async onDestroy(): Promise<void> {
		if (this._destroyed) {
			return;
		}
		this._destroyed = true;
		if (!this._client) {
			return;
		}
		this.setOnlineStatus.cancel();
		this._client.user?.setStatus('dnd');
		await this._client.destroy();
	}

	public readonly setOnlineStatus = _.throttle((status: Partial<DiscordBotStatus>): void => {
		if (this._destroyed || !this._client) {
			return;
		}
		const catcher = (error: Error) => logger.error(error);
		for (const [key, value] of Object.entries(status)) {
			if (value === undefined) {
				continue;
			}
			const channel = this._statusChannels?.[key as keyof Status<number>];
			if (!channel) {
				continue;
			}
			const channelName = `${key[0].toUpperCase()}${key.slice(1)}: ${value}`;
			if (channel.name === channelName) {
				continue;
			}
			channel.setName(channelName).catch(catcher);
		}
	}, STATUS_THROTTLE_TIME);

	private async _getGuildChannel(channelId: string): Promise<GuildChannel | undefined> {
		if (!channelId || !this._client) {
			return undefined;
		}
		const channel = await this._client.channels.fetch(channelId);
		if (!channel || !(channel instanceof GuildChannel)) {
			logger.error('Channel not found', channelId);
			return undefined;
		}
		return channel;
	}
};
