import { freeze } from 'immer';
import * as z from 'zod';
import { AccountIdSchema } from '../account/account.ts';
import { CharacterIdSchema } from '../character/characterTypes.ts';
import { type ChatActionId } from '../chat/chatActions.ts';
import { KnownObject, ParseArrayNotEmpty } from '../utility/misc.ts';
import { ZodCast } from '../validation.ts';
import { ClientNotificationTypeSettingSchema, type ClientNotificationGroupDefinitionBase, type ClientNotificationTypeDefinitionDataShape, type ClientNotificationTypeSetting } from './notificationDefinition.ts';

//#region Notification group definitions

export const CLIENT_NOTIFICATION_GROUPS = {
	chatMessages: {
		name: 'Chat messages',
	},
	contacts: {
		name: 'Direct messages and contacts',
	},
	space: {
		name: 'Space-wide events',
	},
} as const satisfies Readonly<Record<string, Readonly<ClientNotificationGroupDefinitionBase>>>;

//#endregion

//#region Notification types definitions

// Describes settings for a notification type that is disabled by default
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const DEFAULT_DISABLED = freeze<ClientNotificationTypeSetting>({
	persist: false,
	popup: false,
	sound: null,
	suppression: 'not-suppressed',
}, true);
// Describes default minimum settings for notification types
const DEFAULT_MIN = freeze<ClientNotificationTypeSetting>({
	persist: true,
	popup: false,
	sound: null,
	suppression: 'not-suppressed',
}, true);

export const CLIENT_NOTIFICATION_TYPES = {
	chatMessagesMessage: {
		name: 'A character says something',
		group: 'chatMessages',
		metadata: z.object({
			from: CharacterIdSchema,
		}),
		suppressable: 'the chat is visible',
		defaultSettings: DEFAULT_MIN,
	},
	chatMessagesEmote: {
		name: 'A character performs custom action (emote)',
		group: 'chatMessages',
		metadata: z.object({
			from: CharacterIdSchema,
		}),
		suppressable: 'the chat is visible',
		defaultSettings: DEFAULT_MIN,
	},
	chatMessagesOOC: {
		name: 'A character says something in OOC',
		group: 'chatMessages',
		metadata: z.object({
			from: CharacterIdSchema,
		}),
		suppressable: 'the chat is visible',
		defaultSettings: DEFAULT_MIN,
	},
	chatMessagesWhisper: {
		name: 'A character whispers something to you',
		group: 'chatMessages',
		metadata: z.object({
			from: CharacterIdSchema,
		}),
		suppressable: 'the chat is visible',
		defaultSettings: DEFAULT_MIN,
	},
	chatMessagesOOCWhisper: {
		name: 'A character whispers something to you OOC',
		group: 'chatMessages',
		metadata: z.object({
			from: CharacterIdSchema,
		}),
		suppressable: 'the chat is visible',
		defaultSettings: DEFAULT_MIN,
	},
	chatMessagesAction: {
		name: 'A character performs an action',
		group: 'chatMessages',
		metadata: z.object({
			action: ZodCast<ChatActionId>(),
			from: CharacterIdSchema.nullable(),
		}),
		suppressable: 'the chat is visible',
		defaultSettings: DEFAULT_MIN,
	},
	chatMessagesServer: {
		name: 'A server message is received (applies only to messages that do not have specific notification)',
		group: 'chatMessages',
		metadata: z.object({
			action: ZodCast<ChatActionId>(),
			from: CharacterIdSchema.nullable(),
		}),
		suppressable: 'the chat is visible',
		defaultSettings: DEFAULT_MIN,
	},
	contactsDirectMessageReceivedContact: {
		name: 'A direct message is received from a contact',
		group: 'contacts',
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
	contactsDirectMessageReceivedUnknown: {
		name: 'A direct message is received from a non-contact',
		group: 'contacts',
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
	contactsNewContactRequest: {
		name: 'A request to add someone to your contacts was received',
		group: 'contacts',
		metadata: z.object({
			from: AccountIdSchema,
		}),
		suppressable: 'the contacts screen is open',
		defaultSettings: {
			persist: true,
			popup: true,
			sound: {},
			suppression: 'not-suppressed',
		},
	},
	spaceCharacterJoined: {
		name: 'A character joins the current space',
		group: 'space',
		metadata: z.object({
			id: CharacterIdSchema,
		}),
		suppressable: 'the chat is visible',
		defaultSettings: DEFAULT_MIN,
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

export const NotificationTypesSettingsSchema = z.partialRecord(ClientNotificationTypeSchema, ClientNotificationTypeSettingSchema.optional());

//#endregion
