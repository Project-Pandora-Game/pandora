import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder, SlashCommandSubcommandBuilder, type MessageActionRowComponentBuilder, userMention } from 'discord.js';
import { Assert } from 'pandora-common';
import { GetInteractionMember, type DiscordCommandDescriptor, type DiscordButtonDescriptor } from './_common';

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
				.setLabel('Press me!')
				.setStyle(ButtonStyle.Primary);

			const row = new ActionRowBuilder<MessageActionRowComponentBuilder>()
				.addComponents(registerButton);

			await interaction.channel.send({
				embeds: [
					new EmbedBuilder()
						.setColor('Aqua')
						.setDescription(`I'm a bot message with a button! (at least I hope there is one...)`)
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
		await interaction.reply({
			content: `Everyone look! ${userMention(interaction.user.id)} managed to press a button!!`,
			allowedMentions: {
				users: [interaction.user.id],
			},
		});
	},
};
