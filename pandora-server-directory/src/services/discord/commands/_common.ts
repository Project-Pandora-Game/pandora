import { SlashCommandBuilder, CommandInteraction, GuildMember, type ButtonInteraction } from 'discord.js';
import type { Promisable } from 'type-fest';

export function GetInteractionMember(interaction: CommandInteraction | ButtonInteraction): GuildMember | null {
	if (interaction.member instanceof GuildMember) {
		return interaction.member;
	}
	return null;
}

export type DiscordCommandDescriptor = {
	config: Pick<SlashCommandBuilder, 'toJSON' | 'name'>;
	execute: (interaction: CommandInteraction) => Promisable<void>;
};

export type DiscordButtonDescriptor = {
	id: string;
	execute: (interaction: ButtonInteraction) => Promisable<void>;
};
