import { SlashCommandBuilder, userMention } from 'discord.js';
import type { DiscordCommandDescriptor } from './_common.ts';

export const DISCORD_COMMAND_PING: DiscordCommandDescriptor = {
	config: new SlashCommandBuilder()
		.setName('wave')
		.setDescription('Wave to the Pandora\'s bot!'),
	async execute(interaction) {
		await interaction.reply({
			content: `\\**Waves back at ${userMention(interaction.user.id)}*\\* :wave:`,
			allowedMentions: {
				users: [interaction.user.id],
			},
		});
	},
};
