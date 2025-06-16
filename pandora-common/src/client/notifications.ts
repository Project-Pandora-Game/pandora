import { z } from 'zod';
import { AccountIdSchema } from '../account/account.ts';
import { CharacterIdSchema } from '../character/characterTypes.ts';
import { type ChatActionId } from '../chat/chatActions.ts';
import { KnownObject, ParseArrayNotEmpty } from '../utility/misc.ts';
import { ZodCast } from '../validation.ts';
import { ClientNotificationTypeSettingSchema, type ClientNotificationGroupDefinitionBase, type ClientNotificationTypeDefinitionDataShape, type ClientNotificationTypeSetting } from './notificationDefinition.ts';
import { freeze } from 'immer';

//#region Notification group definitions

export const CLIENT_NOTIFICATION_GROUPS = {
	chatMessages: {
		name: 'Chat messages',
	},
	directMessages: {
		name: 'Direct messages',
	},
} as const satisfies Readonly<Record<string, Readonly<ClientNotificationGroupDefinitionBase>>>;

//#endregion

//#region Notification types definitions

// Describes settings for a notification type that is disabled by default
const DEFAULT_DISABLED: ClientNotificationTypeSetting = {
	persist: false,
	popup: false,
	sound: null,
	suppression: 'not-suppressed',
};
freeze(DEFAULT_DISABLED, true);

export const CLIENT_NOTIFICATION_TYPES = {
	chatMessagesMessage: {
		name: 'Character says something',
		group: 'chatMessages',
		metadata: z.object({
			from: CharacterIdSchema,
		}),
		suppressable: 'the chat is visible',
		defaultSettings: DEFAULT_DISABLED,
	},
	chatMessagesEmote: {
		name: 'Character performs custom action (emote)',
		group: 'chatMessages',
		metadata: z.object({
			from: CharacterIdSchema,
		}),
		suppressable: 'the chat is visible',
		defaultSettings: DEFAULT_DISABLED,
	},
	chatMessagesOOC: {
		name: 'Character says something in OOC',
		group: 'chatMessages',
		metadata: z.object({
			from: CharacterIdSchema,
		}),
		suppressable: 'the chat is visible',
		defaultSettings: DEFAULT_DISABLED,
	},
	chatMessagesWhisper: {
		name: 'Character whispers something to you',
		group: 'chatMessages',
		metadata: z.object({
			from: CharacterIdSchema,
		}),
		suppressable: 'the chat is visible',
		defaultSettings: DEFAULT_DISABLED,
	},
	chatMessagesOOCWhisper: {
		name: 'Character whispers something to you OOC',
		group: 'chatMessages',
		metadata: z.object({
			from: CharacterIdSchema,
		}),
		suppressable: 'the chat is visible',
		defaultSettings: DEFAULT_DISABLED,
	},
	chatMessagesAction: {
		name: 'Character performs an action',
		group: 'chatMessages',
		metadata: z.object({
			action: ZodCast<ChatActionId>(),
			from: CharacterIdSchema.nullable(),
		}),
		suppressable: 'the chat is visible',
		defaultSettings: DEFAULT_DISABLED,
	},
	chatMessagesServer: {
		name: 'A server message is received (applies only to messages that do not have specific notification)',
		group: 'chatMessages',
		metadata: z.object({
			action: ZodCast<ChatActionId>(),
			from: CharacterIdSchema.nullable(),
		}),
		suppressable: 'the chat is visible',
		defaultSettings: DEFAULT_DISABLED,
	},
	directMessagesReceivedContact: {
		name: 'A direct message is received from a contact',
		group: 'directMessages',
		metadata: z.object({
			from: AccountIdSchema,
		}),
		suppressable: 'the relevant DM is open',
		defaultSettings: {
			persist: true,
			popup: true,
			sound: {},
			suppression: 'not-suppressed',
		},
	},
	directMessagesReceivedUnknown: {
		name: 'A direct message is received from a non-contact',
		group: 'directMessages',
		metadata: z.object({
			from: AccountIdSchema,
		}),
		suppressable: 'the relevant DM is open',
		defaultSettings: {
			persist: true,
			popup: true,
			sound: {},
			suppression: 'not-suppressed',
		},
	},
} as const satisfies Readonly<ClientNotificationTypeDefinitionDataShape>;

//#endregion

//#region Support code

Object.freeze(CLIENT_NOTIFICATION_GROUPS);
for (const group of Object.values(CLIENT_NOTIFICATION_GROUPS)) {
	Object.freeze(group);
}
Object.freeze(CLIENT_NOTIFICATION_TYPES);
for (const type of Object.values(CLIENT_NOTIFICATION_TYPES)) {
	Object.freeze(type);
}

export const ClientNotificationGroupSchema = z.enum(ParseArrayNotEmpty(KnownObject.keys(CLIENT_NOTIFICATION_GROUPS)));
export type ClientNotificationGroup = z.infer<typeof ClientNotificationGroupSchema>;

export const ClientNotificationTypeSchema = z.enum(ParseArrayNotEmpty(KnownObject.keys(CLIENT_NOTIFICATION_TYPES)));
export type ClientNotificationType = z.infer<typeof ClientNotificationTypeSchema>;

export const NotificationTypesSettingsSchema = z.record(ClientNotificationTypeSchema, ClientNotificationTypeSettingSchema.optional());

//#endregion
