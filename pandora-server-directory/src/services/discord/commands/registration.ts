import {
	ActionRowBuilder,
	ApplicationCommandOptionType,
	ButtonBuilder,
	ButtonStyle,
	ChannelType,
	DiscordAPIError,
	EmbedBuilder,
	PermissionFlagsBits,
	SlashCommandBooleanOption,
	SlashCommandBuilder,
	SlashCommandIntegerOption,
	SlashCommandSubcommandBuilder,
	userMention,
	type GuildMember,
	type MessageActionRowComponentBuilder,
} from 'discord.js';
import { Assert, AssertNever, GetLogger, TimeSpanMs } from 'pandora-common';
import { ACTOR_PANDORA } from '../../../account/actorPandora.ts';
import { ENV } from '../../../config.ts';
import { BetaKeyStore } from '../../../shard/betaKeyStore.ts';
import { Sleep } from '../../../utility.ts';
import { BetaRegistrationService } from '../../betaRegistration/betaRegistration.ts';
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
				.setName('registration-prune')
				.setDescription('Prune the registered people, removing anyone without role or no longer in the server')
				.addBooleanOption(
					new SlashCommandBooleanOption()
						.setName('dry-run')
						.setDescription('Perform a dry run'),
				),
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
		if (!interaction.isChatInputCommand()) {
			await interaction.reply({
				ephemeral: true,
				content: `Error: Unknown subcommand.`,
			});
			return;
		}

		const member = GetInteractionMember(interaction);
		const subcommand = interaction.options.getSubcommand();
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

			if (interaction.channel.type !== ChannelType.GuildText) {
				await interaction.reply({
					ephemeral: true,
					content: `Error: This command can only be used in a standard text channel.`,
				});
				return;
			}

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
		} else if (subcommand === 'registration-prune') {
			const dryRunOption = interaction.options.get('dry-run');
			Assert(dryRunOption == null || typeof dryRunOption.value === 'boolean');
			const dryRun = dryRunOption?.value === true;

			logger.verbose(`Running registration prune${dryRun ? ' (dry run)' : ''}`);
			await interaction.reply({
				content: `:hourglass_flowing_sand: Running registration prune${dryRun ? ' (dry run)' : ''}`,
			});

			await BetaRegistrationService.pruneCandidates(async (candidate) => {
				Assert(interaction.guild != null);

				// Sleep not to run into any throttling (hopefully)
				await Sleep(120);

				let candidateMember: GuildMember;
				// Check membership
				try {
					candidateMember = await interaction.guild.members.fetch({ user: candidate.discordId, force: true });
				} catch (err) {
					if (err instanceof DiscordAPIError) {
						if (err.code === 10_007) {
							logger.verbose(`Candidate ${candidate.discordId} not found in the guild, removing.`);
							return false;
						} else {
							logger.warning(`Failed to get candidate member status for ${candidate.discordId}, unknown Discord error:`, err.code, err.message);
						}
					} else {
						logger.warning(`Failed to get candidate member status for ${candidate.discordId}, unknown error:`, err);
					}
					return true;
				}

				// Check beta role
				const betaAccessRole = candidateMember.roles.resolve(DISCORD_BETA_ACCESS_ROLE_ID);
				if (betaAccessRole != null) {
					// This shouldn't happen: People that already have access shouldn't be candidates
					logger.warning(`Candidate ${candidate.discordId} already has beta access role; skip.`);
					return true;
				}

				// Check candidate role
				const betaCandidateRole = candidateMember.roles.resolve(DISCORD_BETA_REGISTRATION_PENDING_ROLE_ID);
				if (betaCandidateRole == null) {
					logger.debug(`Candidate ${candidate.discordId} doesn't have candidate role, removing.`);
					return false;
				}

				// A valid candidate
				return true;
			}, dryRun);

			await interaction.followUp({
				content: `:white_check_mark: Prune completed, check server log for details.`,
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
				// Pause for a bit between candidates not to run into any rate limit
				await Sleep(1_500);

				// Race condition prevention (just a simple one, it shouldn't happen anyway)
				if (candidate.invited)
					continue;

				try {
					// Find the candidate in the server
					const candidateMember = await interaction.guild.members.fetch({ user: candidate.discordId });

					let token: string;

					if (candidate.assignedKey != null) {
						token = candidate.assignedKey;
						logger.warning(`Candidate ${candidate.discordId} already has a key (${candidate.assignedKey.substring(0, 8)}), resending.`);
					} else {
						// Generate a new beta key for them
						const key = await BetaKeyStore.create(ACTOR_PANDORA, {
							maxUses: 1,
							expires: Date.now() + TimeSpanMs(30, 'days'),
						});
						Assert(typeof key !== 'string');
						// Store the key to avoid generating multiple for one person,
						// even if sending it fails
						const assignmentResult = await BetaRegistrationService.assignCandidateKey(candidate.discordId, key.token);

						if (!assignmentResult) {
							logger.warning(`Failed to assign beta key ${key.id} to ${candidate.discordId}`);
							continue;
						}

						token = key.token;
					}

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
							`${token}\n` +
							'```\n' +
							`You can register with it at https://project-pandora.com\n` +
							`You were also given access to betatester channels on Pandora's Discord where you can talk with other betatesters, share suggestions, or inform us about any issues you encounter. You can find those channels here: https://discord.com/channels/872284471611760720/1120733020962431046\n` +
							`\n` +
							`Have fun!\n`,
					});

					// Only after successful DM mark the candidate as invited
					if (!await BetaRegistrationService.finalizeInvitation(candidate.discordId)) {
						logger.warning(`Failed to finalize invitation of ${candidate.discordId}`);
						continue;
					}

					successful++;
					logger.verbose(`Successfully sent an invite to user ${candidate.discordId} (token: ${token})`);
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
