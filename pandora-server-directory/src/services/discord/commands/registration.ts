import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder, SlashCommandSubcommandBuilder, type MessageActionRowComponentBuilder, SlashCommandIntegerOption, ApplicationCommandOptionType, userMention } from 'discord.js';
import { Assert, AssertNever, GetLogger, TimeSpanMs } from 'pandora-common';
import { ENV } from '../../../config';
import { BetaRegistrationService } from '../../betaRegistration/betaRegistration';
import { GetInteractionMember, type DiscordButtonDescriptor, type DiscordCommandDescriptor } from './_common';
import { Sleep } from '../../../utility';
import { BetaKeyStore } from '../../../shard/betaKeyStore';
import { ACTOR_PANDORA } from '../../../account/actorPandora';

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
				.setName('mass-invite')
				.setDescription('Send out invites to a specified count of people')
				.addIntegerOption(
					new SlashCommandIntegerOption()
						.setName('count')
						.setDescription('How many people to invite')
						.setMinValue(1)
						.setRequired(true),
				),
		),
	async execute(interaction) {
		const member = GetInteractionMember(interaction);
		const subcommand = interaction.isChatInputCommand() ? interaction.options.getSubcommand() : null;
		logger.debug(`Admin command "${subcommand}" used by ${interaction.user.username} (${interaction.user.id}) in guild ${interaction.guild?.id ?? '[none]'}`);

		if (!member || !member.permissions.has(PermissionFlagsBits.Administrator)) {
			await interaction.reply({
				ephemeral: true,
				content: `Error: Only administrators can use this inside the server. Sorry.`,
			});
			return;
		}

		if (subcommand === 'add-registration-form') {
			Assert(interaction.channel != null);
			logger.info(`Adding registration form in channel ${interaction.guild?.id ?? '[none]'}/${interaction.channel.id}, triggered by ${interaction.user.username} (${interaction.user.id})`);

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
		} else if (subcommand === 'mass-invite') {
			const count = interaction.options.get('count', true);
			Assert(count.type === ApplicationCommandOptionType.Integer);
			Assert(typeof count.value === 'number');
			Assert(Number.isInteger(count.value));
			Assert(count.value >= 1);
			Assert(interaction.guild != null);

			logger.alert(`Sending invites to ${count.value} people, triggered by ${interaction.user.username} (${interaction.user.id})`);
			await interaction.reply({
				content: `:hourglass_flowing_sand: Sending invites to ${count.value} people...`,
			});

			const candidates = BetaRegistrationService.getCandidates(count.value);

			let successful = 0;
			for (const candidate of candidates) {
				// Pause for half a second between candidates not to run into any rate limit
				await Sleep(500);

				// Race condition prevention (just a simple one, it shouldn't happen anyway)
				if (candidate.assignedKey != null)
					continue;

				try {
					// Find the candidate in the server
					const candidateMember = await interaction.guild.members.fetch({ user: candidate.discordId });

					// Generate a new beta key for them
					const key = await BetaKeyStore.create(ACTOR_PANDORA, {
						maxUses: 1,
						expires: Date.now() + TimeSpanMs(30, 'days'),
					});
					Assert(typeof key !== 'string');

					// Give user roles
					await candidateMember.roles.remove(DISCORD_BETA_REGISTRATION_PENDING_ROLE_ID, 'Automatic beta handout');
					await candidateMember.roles.add(DISCORD_BETA_ACCESS_ROLE_ID, 'Automatic beta handout');

					// Send user DM with the key
					const dmChannel = await candidateMember.createDM();
					await dmChannel.send({
						content: `Hello ${userMention(candidateMember.user.id)}!\n` +
							`Some time ago you have registered to join the beta of **Project Pandora** and now you have been selected! Congratulations!\n` +
							`Here is your beta registration key. It can be used only once and expires in 30 days.\n` +
							'```\n' +
							`${key.token}\n` +
							'```\n' +
							`You can register with it at https://project-pandora.com\n` +
							`You were also given access to betatester channels on Pandora's Discord where you can talk with other betatesters, share suggestions, or inform us about any issues you encounter. You can find those channels here: https://discord.com/channels/872284471611760720/1120733020962431046\n` +
							`\n` +
							`Have fun!\n`,
					});

					// Only after successful DM mark the candidate as having received a key
					const assignmentResult = await BetaRegistrationService.assignCandidateKey(candidate.discordId, key.id);

					if (!assignmentResult) {
						logger.warning(`Failed to assign beta key ${key.id} to ${candidate.discordId}`);
						continue;
					}

					successful++;
					logger.verbose(`Successfully sent an invite to user ${candidate.discordId} (token: ${key.id})`);
				} catch (error) {
					logger.warning(`Failed to invite user ${candidate.discordId} (token: ${candidate.assignedKey}):`, error);
				}
			}
			logger.info(`Done sending invites, successfully invited ${successful} people.`);
			await interaction.followUp({
				content: `:white_check_mark: Done sending invites! ${successful} were added successfully.`,
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
		logger.debug(`Registration button pressed by ${interaction.user.username} (${interaction.user.id}) in guild ${interaction.guild?.id ?? '[none]'}`);

		if (!BETA_KEY_ENABLED || !DISCORD_BETA_REGISTRATION_PENDING_ROLE_ID || !DISCORD_BETA_ACCESS_ROLE_ID) {
			logger.verbose('Registration press ignored - registrations not enabled');
			await interaction.reply({
				ephemeral: true,
				content: `Error: Beta registrations are not enabled.`,
			});
			return;
		}

		const member = GetInteractionMember(interaction);

		if (!member) {
			logger.verbose('Registration press ignored - done outside of server');
			await interaction.reply({
				ephemeral: true,
				content: `Error: This action can only be done from inside Project Pandora's server.`,
			});
			return;
		}

		const hasBetaAccessRole = member.roles.cache.has(DISCORD_BETA_ACCESS_ROLE_ID);
		if (hasBetaAccessRole) {
			logger.verbose('Registration press ignored - already has a beta access role');
			await interaction.reply({
				ephemeral: true,
				content: `You already have access to Project Pandora's beta. Check direct messages from me to find your beta key.\n` +
					`If you have problems getting into the beta or if you lost your key, please contact any \`@Host\`.`,
			});
			return;
		}

		const registerResult = await BetaRegistrationService.registerUser(interaction.user.id);

		if (registerResult === 'betaAccess') {
			logger.verbose('Registration press processed, already has access, giving roles');
			await member.roles.remove(DISCORD_BETA_REGISTRATION_PENDING_ROLE_ID, 'Automatic beta handout');
			await member.roles.add(DISCORD_BETA_ACCESS_ROLE_ID, 'Automatic beta handout');
			await interaction.reply({
				ephemeral: true,
				content: `You already have access to Project Pandora's beta. Check direct messages from me to find your beta key.\n` +
					`If you have problems getting into the beta or if you lost your key, please contact any \`@Host\`.`,
			});
		} else if (registerResult === 'added') {
			logger.verbose('Registration press processed, registered');
			await member.roles.add(DISCORD_BETA_REGISTRATION_PENDING_ROLE_ID, 'Automatic beta registration');
			await interaction.reply({
				ephemeral: true,
				content: `You have been successfully registered for Project Pandora's beta. You will receive ` +
					`a direct message with a beta key when you are selected.`,
			});
		} else if (registerResult === 'pending') {
			logger.verbose('Registration press processed, already pending, giving roles');
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
