import {
	ActionRowBuilder,
	ApplicationCommandOptionType,
	ButtonBuilder,
	ButtonStyle,
	ChannelType,
	EmbedBuilder,
	MessageFlags,
	PermissionFlagsBits,
	SlashCommandBuilder,
	SlashCommandStringOption,
	SlashCommandSubcommandBuilder,
	userMention,
	type MessageActionRowComponentBuilder,
} from 'discord.js';
import { Assert, FormatTimeInterval, GetLogger } from 'pandora-common';
import { ENV } from '../../../config.ts';
import { BETA_REGISTRATION_COOLDOWN, BetaRegistrationService } from '../../betaRegistration/betaRegistration.ts';
import { GetInteractionMember, type DiscordButtonDescriptor, type DiscordCommandDescriptor } from './_common.ts';

const {
	BETA_KEY_ENABLED,
	DISCORD_BETA_REGISTRATION_PENDING_ROLE_ID,
	DISCORD_BETA_ACCESS_ROLE_ID,
} = ENV;

const logger = GetLogger('DiscordBot').prefixMessages('Registration:');

export const DISCORD_COMMAND_ADMIN: DiscordCommandDescriptor = {
	config: new SlashCommandBuilder()
		.setName('admin')
		.setDescription('Administrative tasks for Pandora')
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.addSubcommand(
			new SlashCommandSubcommandBuilder()
				.setName('add-registration-form')
				.setDescription('Send a registration form message'),
		)
		.addSubcommand(
			new SlashCommandSubcommandBuilder()
				.setName('say')
				.setDescription('Send specific message')
				.addStringOption(new SlashCommandStringOption()
					.setName('msg')
					.setDescription('The message to send')
					.setRequired(true),
				),
		),
	async execute(interaction) {
		if (!interaction.isChatInputCommand()) {
			await interaction.reply({
				flags: [MessageFlags.Ephemeral],
				content: `Error: Unknown subcommand.`,
			});
			return;
		}

		const member = GetInteractionMember(interaction);
		const subcommand = interaction.options.getSubcommand();
		logger.debug(`Admin command "${subcommand}" used by ${interaction.user.username} (${interaction.user.id}) in guild ${interaction.guild?.id ?? '[none]'}`);

		if (!member || !member.permissions.has(PermissionFlagsBits.Administrator)) {
			await interaction.reply({
				flags: [MessageFlags.Ephemeral],
				content: `Error: Only administrators can use this inside the server. Sorry.`,
			});
			return;
		}

		if (subcommand === 'add-registration-form') {
			Assert(interaction.channel != null);
			logger.info(`Adding registration form in channel ${interaction.guild?.id ?? '[none]'}/${interaction.channel.id}, triggered by ${interaction.user.username} (${interaction.user.id})`);

			const registerButton = new ButtonBuilder()
				.setCustomId('button-register')
				.setLabel('Register for the beta')
				.setStyle(ButtonStyle.Primary);

			const row = new ActionRowBuilder<MessageActionRowComponentBuilder>()
				.addComponents(registerButton);

			if (interaction.channel.type !== ChannelType.GuildText) {
				await interaction.reply({
					flags: [MessageFlags.Ephemeral],
					content: `Error: This command can only be used in a standard text channel.`,
				});
				return;
			}

			await interaction.channel.send({
				embeds: [
					new EmbedBuilder()
						.setColor('#3DAEE9')
						.setDescription(`Click the button below to get a Project Pandora beta key.`)
						.toJSON(),
				],
				components: [row.toJSON()],
			});

			await interaction.reply({
				flags: [MessageFlags.Ephemeral],
				content: `Done! :white_check_mark:`,
			});
		} else if (subcommand === 'say') {
			const msg = interaction.options.get('msg', true);
			Assert(msg.type === ApplicationCommandOptionType.String);
			Assert(typeof msg.value === 'string');
			Assert(interaction.guild != null);

			if (interaction.channel == null || interaction.channel.type !== ChannelType.GuildText) {
				await interaction.reply({
					flags: [MessageFlags.Ephemeral],
					content: `Error: This command can only be used in a standard text channel.`,
				});
				return;
			}

			logger.info(`Sending message "${msg.value}", triggered by ${interaction.user.username} (${interaction.user.id})`);

			await interaction.channel.send({
				content: msg.value,
			});

			await interaction.reply({
				content: `:white_check_mark: Ok!`,
				flags: [MessageFlags.Ephemeral],
			});
		} else {
			await interaction.reply({
				flags: [MessageFlags.Ephemeral],
				content: `Error: Unknown subcommand.`,
			});
		}
	},
};

export const DISCORD_BUTTON_REGISTER: DiscordButtonDescriptor = {
	id: 'button-register',
	async execute(interaction) {
		logger.debug(`Registration button pressed by ${interaction.user.username} (${interaction.user.id}) in guild ${interaction.guild?.id ?? '[none]'}`);

		if (!BETA_KEY_ENABLED || !DISCORD_BETA_REGISTRATION_PENDING_ROLE_ID || !DISCORD_BETA_ACCESS_ROLE_ID) {
			logger.verbose('Registration press ignored - registrations not enabled');
			await interaction.reply({
				flags: [MessageFlags.Ephemeral],
				content: `Error: Beta registrations are not enabled.`,
			});
			return;
		}

		const member = GetInteractionMember(interaction);

		if (!member) {
			logger.verbose('Registration press ignored - done outside of server');
			await interaction.reply({
				flags: [MessageFlags.Ephemeral],
				content: `Error: This action can only be done from inside Project Pandora's server.`,
			});
			return;
		}

		const registerResult = await BetaRegistrationService.registerUser(interaction.user.id);

		await member.roles.remove(DISCORD_BETA_REGISTRATION_PENDING_ROLE_ID, 'Automatic beta handout');
		await member.roles.add(DISCORD_BETA_ACCESS_ROLE_ID, 'Automatic beta handout');

		if (registerResult.isNew) {
			await interaction.reply({
				flags: [MessageFlags.Ephemeral],
				content: `Hello ${userMention(member.user.id)}!\n` +
					`Here is your beta registration key. It can be used only once and expires in ${FormatTimeInterval(BETA_REGISTRATION_COOLDOWN, 'two-most-significant')}.\n` +
					'```\n' +
					`${registerResult.key}\n` +
					'```\n' +
					`You can register with it at <https://project-pandora.com/register?betaKey=${encodeURIComponent(registerResult.key)}>\n` +
					`\n` +
					`After the key expires you will be able to request another key.\n` +
					`\n` +
					`Have fun!\n`,
			});
		} else {
			await interaction.reply({
				flags: [MessageFlags.Ephemeral],
				content: `Hello ${userMention(member.user.id)}!\n` +
					`You have already recently requested a beta key. Your current key will expire on <t:${Math.floor(registerResult.expires / 1000)}>.\n` +
					`Your current key is:\n` +
					'```\n' +
					`${registerResult.key}\n` +
					'```\n' +
					`You can register with it at <https://project-pandora.com/register?betaKey=${encodeURIComponent(registerResult.key)}>\n` +
					`\n` +
					`After the key expires you will be able to request another key.\n` +
					`\n` +
					`Have fun!\n`,
			});
		}
	},
};
