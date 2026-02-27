import * as Discord from 'discord.js';
import { Events, GatewayIntentBits, GuildChannel, REST, Routes, type ClientOptions, type Interaction } from 'discord.js';
import { throttle } from 'lodash-es';
import { Assert, GetLogger, ServerService } from 'pandora-common';
import promClient from 'prom-client';
import { ENV } from '../../config.ts';
import type { DiscordButtonDescriptor, DiscordCommandDescriptor } from './commands/_common.ts';
import { DISCORD_COMMAND_PING } from './commands/ping.ts';
import { DISCORD_BUTTON_REGISTER, DISCORD_COMMAND_ADMIN } from './commands/registration.ts';
const { DISCORD_BOT_TOKEN, DISCORD_BOT_ACCOUNT_STATUS_CHANNEL_ID, DISCORD_BOT_CHARACTER_STATUS_CHANNEL_ID } = ENV;

const STATUS_THROTTLE_TIME = 10 * 60 * 1000; // 10 minutes

const GATEWAY_INTENTS: ClientOptions['intents'] = [
	GatewayIntentBits.Guilds,
	GatewayIntentBits.GuildIntegrations,
];

const DISCORD_COMMANDS: readonly DiscordCommandDescriptor[] = [
	DISCORD_COMMAND_PING,
	DISCORD_COMMAND_ADMIN,
];

const DISCORD_BUTTONS: readonly DiscordButtonDescriptor[] = [
	DISCORD_BUTTON_REGISTER,
];

const logger = GetLogger('DiscordBot');

const buttonInteractionMetric = new promClient.Counter({
	name: 'pandora_discord_button_interaction_total',
	help: 'Count of received button interactions',
	labelNames: ['buttonId'],
});

type Status<T> = {
	accounts: T;
	characters: T;
};

export type DiscordBotStatus = Status<number>;

export const DiscordBot = new class DiscordBot implements ServerService {
	private _client?: Discord.Client;
	private _statusChannels?: Partial<Status<GuildChannel>>;
	private _destroyed = false;

	public async init(): Promise<void> {
		if (!DISCORD_BOT_TOKEN) {
			logger.warning('Secret is not set, Discord Bot is disabled', DISCORD_BOT_TOKEN);
			return;
		}

		this._client = new Discord.Client({
			intents: GATEWAY_INTENTS,
		});

		this._client.on(Events.InteractionCreate, (interaction) => {
			this._handleInteractionCreate(interaction)
				.catch((error) => logger.error('Error handling interaction:', error));
		});

		const result = await this._client.login(DISCORD_BOT_TOKEN);
		if (result !== DISCORD_BOT_TOKEN) {
			logger.error('Discord login failed');
			return;
		}

		await new Promise((resolve, reject) => {
			this._client?.once('clientReady', resolve);
			this._client?.once('error', reject);
		});

		Assert(this._client.isReady());

		//#region Init status channels
		/** Call with no status to trigger throttle */
		this.setOnlineStatus({});

		this._statusChannels = {
			accounts: DISCORD_BOT_ACCOUNT_STATUS_CHANNEL_ID ? await this._getGuildChannel(DISCORD_BOT_ACCOUNT_STATUS_CHANNEL_ID) : undefined,
			characters: DISCORD_BOT_CHARACTER_STATUS_CHANNEL_ID ? await this._getGuildChannel(DISCORD_BOT_CHARACTER_STATUS_CHANNEL_ID) : undefined,
		};
		//#endregion

		//#region Init commands metadata
		await new REST()
			.setToken(DISCORD_BOT_TOKEN)
			.put(
				Routes.applicationCommands(this._client.application.id),
				{
					body: DISCORD_COMMANDS.map((c) => c.config.toJSON()),
				},
			);
		//#endregion

		this._client.user.setPresence({
			status: 'online',
		});
		logger.info('Discord Bot is ready');
	}

	public async onDestroy(): Promise<void> {
		if (this._destroyed) {
			return;
		}
		this._destroyed = true;
		if (!this._client) {
			return;
		}
		this._setOnlineStatusInternal.cancel();
		this._client.user?.setStatus('dnd');
		await this._client.destroy();
	}

	public setOnlineStatus(status: Partial<DiscordBotStatus>): void {
		if (this._destroyed || !this._client) {
			return;
		}
		this._setOnlineStatusInternal(status);
	}

	private readonly _setOnlineStatusInternal = throttle((status: Partial<DiscordBotStatus>): void => {
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

	private async _handleInteractionCreate(interaction: Interaction): Promise<void> {
		if (interaction.isChatInputCommand()) {
			const command = DISCORD_COMMANDS.find((c) => c.config.name === interaction.commandName);

			if (!command) {
				logger.warning(`Unknown command used: '${interaction.commandName}'`);

				await interaction.reply({
					flags: [Discord.MessageFlags.Ephemeral],
					content: `Error: I don't recognize the command "${interaction.commandName}"`,
				});
				return;
			}

			try {
				await command.execute(interaction);
			} catch (error) {
				logger.error(`Error executing command "${interaction.commandName}":`, error);
				if (interaction.replied || interaction.deferred) {
					await interaction.followUp({ content: 'Error: Something went wrong while executing your command!', flags: [Discord.MessageFlags.Ephemeral] });
				} else {
					await interaction.reply({ content: 'Error: Something went wrong while executing your command!', flags: [Discord.MessageFlags.Ephemeral] });
				}
			}

			return;
		}

		if (interaction.isButton()) {
			const button = DISCORD_BUTTONS.find((b) => b.id === interaction.customId);

			if (!button) {
				logger.warning(`Unknown button used: '${interaction.customId}'`);

				await interaction.reply({
					flags: [Discord.MessageFlags.Ephemeral],
					content: `Error: I don't recognize the button you pressed!`,
				});
				return;
			}

			buttonInteractionMetric.inc({ buttonId: button.id });

			try {
				await button.execute(interaction);
			} catch (error) {
				logger.error(`Error executing button handler "${interaction.customId}":`, error);
				if (interaction.replied || interaction.deferred) {
					await interaction.followUp({ content: 'Error: Something went wrong while processing your action!', flags: [Discord.MessageFlags.Ephemeral] });
				} else {
					await interaction.reply({ content: 'Error: Something went wrong while processing your action!', flags: [Discord.MessageFlags.Ephemeral] });
				}
			}

			return;
		}

		// Other interactions are not supported: Just ignore them
	}
};
