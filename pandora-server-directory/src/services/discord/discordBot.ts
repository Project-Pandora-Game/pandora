import Discord, { BitFieldResolvable, GatewayIntentsString, GuildChannel } from 'discord.js';
import _ from 'lodash';
import { GetLogger } from 'pandora-common';

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || '';
const DISCORD_BOT_ACCOUNT_STATUS_CHANNEL_ID = process.env.DISCORD_BOT_ACCOUNT_STATUS_CHANNEL_ID || '';
const DISCORD_BOT_CHARACTER_STATUS_CHANNEL_ID = process.env.DISCORD_BOT_CHARACTER_STATUS_CHANNEL_ID || '';

const STATUS_THROTTLE_TIME = 5_000; // 5 seconds

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

export const DiscordBot = new class DiscordBot {
	private readonly _client = new Discord.Client({
		intents: GATEWAY_INTENTS,
	});
	private _statusChannels?: Partial<Status<GuildChannel>>;

	public async init(): Promise<this> {
		if (!DISCORD_BOT_TOKEN) {
			logger.warning('Secret is not set, Discord Bot is disabled', DISCORD_BOT_TOKEN);
			return this;
		}

		const result = await this._client.login(DISCORD_BOT_TOKEN);
		if (result !== DISCORD_BOT_TOKEN) {
			logger.error('Discord login failed');
			return this;
		}

		this._statusChannels = {
			accounts: await this._getGuildChannel(DISCORD_BOT_ACCOUNT_STATUS_CHANNEL_ID),
			characters: await this._getGuildChannel(DISCORD_BOT_CHARACTER_STATUS_CHANNEL_ID),
		};

		this.setOnlineStatus({
			accounts: 0,
			characters: 0,
		});

		logger.info('Discord Bot is ready');

		return this;
	}

	public readonly setOnlineStatus = _.throttle((status: Partial<DiscordBotStatus>): void => {
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
		if (!channelId) {
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
