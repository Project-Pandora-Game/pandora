import { freeze } from 'immer';
import { nanoid } from 'nanoid';
import * as z from 'zod';
import { LIMIT_BOT_DESCRIPTION_LENGTH, LIMIT_BOT_NAME_LENGTH, LIMIT_BOT_NAME_PATTERN } from '../inputLimits.ts';
import { KnownObject } from '../utility/misc.ts';
import { ZodTemplateString, ZodTrimedRegex } from '../validation.ts';

//#region ID

/** Unique identifier of a bot account. */
export type BotId = `bot:${string}`;
/** Unique identifier of a bot account. */
export const BotIdSchema: z.ZodType<BotId> = ZodTemplateString<BotId>(z.string(), /^bot:[A-Za-z0-9_-]{32}$/);

/** Creates a random Bot ID */
export function CreateRandomBotId(): BotId {
	return BotIdSchema.parse(`bot:${nanoid(32)}` satisfies BotId);
}

/** Equivalent of `CharacterId` for actions caused by space's bot. */
export type VirtualBotCharacter = 'bot';
export const VirtualBotCharacterSchema: z.ZodLiteral<VirtualBotCharacter> = z.literal('bot');

//#endregion

//#region Bot name, description

/** Developer-specified name of a bot. */
export type BotName = string;
/** Developer-specified name of a bot. */
export const BotNameSchema: z.ZodString = z.string()
	.min(3)
	.max(LIMIT_BOT_NAME_LENGTH)
	.regex(LIMIT_BOT_NAME_PATTERN)
	.regex(ZodTrimedRegex);

/** Developer-specified description of a bot. */
export const BotDescriptionSchema: z.ZodString = z.string()
	.max(LIMIT_BOT_DESCRIPTION_LENGTH)
	.regex(ZodTrimedRegex);

//#endregion

//#region Space permissions

const PANDORA_BOT_SPACE_PERMISSIONS_DEFINITION = {
	'change_admins': {
		name: 'Modify admin list',
		description: 'Allows the bot to add and remove space\'s admins.',
	},
	'kick': {
		name: 'Kick characters',
		description: 'Allows the bot to kick any non-admin character.',
	},
	'ban': {
		name: 'Ban characters',
		description: 'Allows the bot to ban any non-admin character or un-ban them. Note, that this effectively implies "Kick characters".',
	},
} as const satisfies Record<string, PandoraBotSpacePermissionDefinition>;

/** List of things that bots can ALWAYS do, for transparency */
export const PANDORA_BOT_SPACE_PASSIVE_PERMISSIONS: { name: string; description: string; }[] = [
	{
		name: 'Read space\'s metadata',
		description: 'Read info about the space, such as its unique id, name, owners, admin/allow/ban lists, and other settings.',
	},
	{
		name: 'Read space\'s state',
		description: 'Read the state of the space, including all rooms and all items or devices the rooms contain.',
	},
	{
		name: 'Read space\'s characters',
		description: 'Read which characters are present in the space, basic info about them, and their state, including body shape and worn items.',
	},
	{
		name: 'Register custom commands',
		description: `Register custom chat commands that can be used by using '!' instead of '/'.`,
	},
];

// Both validate and export the config
export const PANDORA_BOT_SPACE_PERMISSIONS: Readonly<Record<PandoraBotSpacePermission, PandoraBotSpacePermissionDefinition>> = PANDORA_BOT_SPACE_PERMISSIONS_DEFINITION;
freeze(PANDORA_BOT_SPACE_PERMISSIONS, true);

export type PandoraBotSpacePermissionDefinition = {
	name: string;
	description: string;
};

export type PandoraBotSpacePermission = keyof typeof PANDORA_BOT_SPACE_PERMISSIONS_DEFINITION;
export const PandoraBotSpacePermissionSchema: z.ZodType<PandoraBotSpacePermission> = z.enum(KnownObject.keys(PANDORA_BOT_SPACE_PERMISSIONS_DEFINITION));

export type PandoraBotSpacePermissionList = readonly PandoraBotSpacePermission[];
export const PandoraBotSpacePermissionListSchema: z.ZodType<PandoraBotSpacePermissionList> = PandoraBotSpacePermissionSchema.array()
	.max(KnownObject.keys(PANDORA_BOT_SPACE_PERMISSIONS_DEFINITION).length);

//#endregion
