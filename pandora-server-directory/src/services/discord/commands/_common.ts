import { SlashCommandBuilder, CommandInteraction, GuildMember } from 'discord.js';
import type { Promisable } from 'type-fest';

export function GetInteractionMember(interaction: CommandInteraction): GuildMember | null {
	if (interaction.member instanceof GuildMember) {
		return interaction.member;
	}
	return null;
}

export type DiscordCommandDescriptor = {
	config: SlashCommandBuilder;
	execute: (interaction: CommandInteraction) => Promisable<void>;
};
