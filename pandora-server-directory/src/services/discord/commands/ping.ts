import { SlashCommandBuilder } from 'discord.js';
import { GetInteractionMember, type DiscordCommandDescriptor } from './_common';

export const DISCORD_COMMAND_PING: DiscordCommandDescriptor = {
	config: new SlashCommandBuilder()
		.setName('wave')
		.setDescription('Wave to the Pandora\'s bot!'),
	async execute(interaction) {
		const nickname = GetInteractionMember(interaction)?.nickname ?? interaction.user.displayName;

		await interaction.reply({
			content: `\\**Waves back at ${nickname}*\\* :wave:`,
		});
	},
};
