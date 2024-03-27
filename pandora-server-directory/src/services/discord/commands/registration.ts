import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder, SlashCommandSubcommandBuilder, type MessageActionRowComponentBuilder } from 'discord.js';
import { Assert, AssertNever } from 'pandora-common';
import { ENV } from '../../../config';
import { BetaRegistrationService } from '../../betaRegistration/betaRegistration';
import { GetInteractionMember, type DiscordButtonDescriptor, type DiscordCommandDescriptor } from './_common';

const {
	BETA_KEY_ENABLED,
	DISCORD_BETA_REGISTRATION_PENDING_ROLE_ID,
	DISCORD_BETA_ACCESS_ROLE_ID,
} = ENV;

export const DISCORD_COMMAND_ADMIN: DiscordCommandDescriptor = {
	config: new SlashCommandBuilder()
		.setName('admin')
		.setDescription('Administrative tasks for Pandora')
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.addSubcommand(
			new SlashCommandSubcommandBuilder()
				.setName('add-registration-form')
				.setDescription('Send a registration form message'),
		),
	async execute(interaction) {
		const member = GetInteractionMember(interaction);

		if (!member || !member.permissions.has(PermissionFlagsBits.Administrator)) {
			await interaction.reply({
				ephemeral: true,
				content: `Error: Only administrators can use this inside the server. Sorry.`,
			});
			return;
		}

		const subcommand = interaction.isChatInputCommand() ? interaction.options.getSubcommand() : null;

		if (subcommand === 'add-registration-form') {
			Assert(interaction.channel != null);

			const registerButton = new ButtonBuilder()
				.setCustomId('button-register')
				.setLabel('Register for the beta test')
				.setStyle(ButtonStyle.Primary);

			const row = new ActionRowBuilder<MessageActionRowComponentBuilder>()
				.addComponents(registerButton);

			await interaction.channel.send({
				embeds: [
					new EmbedBuilder()
						.setColor('Aqua')
						.setDescription(`To register for the upcoming closed beta test of Project Pandora press the following button. We will send out beta keys in waves while the beta test is ongoing.`)
						.toJSON(),
				],
				components: [row.toJSON()],
			});

			await interaction.reply({
				ephemeral: true,
				content: `Done! :white_check_mark:`,
			});
		} else {
			await interaction.reply({
				ephemeral: true,
				content: `Error: Unknown subcommand.`,
			});
		}
	},
};

export const DISCORD_BUTTON_REGISTER: DiscordButtonDescriptor = {
	id: 'button-register',
	async execute(interaction) {
		if (!BETA_KEY_ENABLED || !DISCORD_BETA_REGISTRATION_PENDING_ROLE_ID || !DISCORD_BETA_ACCESS_ROLE_ID) {
			await interaction.reply({
				ephemeral: true,
				content: `Error: Beta registrations are not enabled.`,
			});
			return;
		}

		const member = GetInteractionMember(interaction);

		if (!member) {
			await interaction.reply({
				ephemeral: true,
				content: `Error: This action can only be done from inside Project Pandora's server.`,
			});
			return;
		}

		const hasBetaAccessRole = member.roles.cache.has(DISCORD_BETA_ACCESS_ROLE_ID);
		if (hasBetaAccessRole) {
			await interaction.reply({
				ephemeral: true,
				content: `You already have access to Project Pandora's beta. Check direct messages from me to find your beta key.\n` +
					`If you have problems getting into the beta or if you lost your key, please contact any \`@Host\`.`,
			});
			return;
		}

		const registerResult = await BetaRegistrationService.registerUser(interaction.user.id);

		if (registerResult === 'betaAccess') {
			await member.roles.remove(DISCORD_BETA_REGISTRATION_PENDING_ROLE_ID, 'Automatic beta handout');
			await member.roles.add(DISCORD_BETA_ACCESS_ROLE_ID, 'Automatic beta handout');
			await interaction.reply({
				ephemeral: true,
				content: `You already have access to Project Pandora's beta. Check direct messages from me to find your beta key.\n` +
					`If you have problems getting into the beta or if you lost your key, please contact any \`@Host\`.`,
			});
		} else if (registerResult === 'added') {
			await member.roles.add(DISCORD_BETA_REGISTRATION_PENDING_ROLE_ID, 'Automatic beta registration');
			await interaction.reply({
				ephemeral: true,
				content: `You have been successfully registered for Project Pandora's beta. You will receive ` +
					`a direct message with a beta key when you are selected.`,
			});
		} else if (registerResult === 'pending') {
			await member.roles.add(DISCORD_BETA_REGISTRATION_PENDING_ROLE_ID, 'Automatic beta registration');
			await interaction.reply({
				ephemeral: true,
				content: `You are already registered for Project Pandora's beta. You will receive ` +
					`a direct message with a beta key when you are selected.`,
			});
		} else {
			AssertNever(registerResult);
		}
	},
};
