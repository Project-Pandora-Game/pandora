import * as z from 'zod';
import { RoomIdSchema } from '../assets/appearanceTypes.ts';
import { CharacterId, CharacterIdSchema } from '../character/characterTypes.ts';
import { LIMIT_CHAT_MESSAGE_LENGTH } from '../inputLimits.ts';
import { HexColorStringSchema } from '../validation.ts';
import { ChatMessageActionLogSchema } from './actionLog.ts';
import { ChatActionIdSchema } from './chatActions.ts';
import { ChatReceivedMessageBaseSchema, IChatMessageActionContainerPathSchema, IChatMessageActionItemSchema, IChatMessageActionTargetCharacterSchema, IChatMessageActionTargetSchema } from './chatCommon.ts';

export const ChatModifierSchema = z.enum(['normal', 'bold', 'italic']);
export type IChatModifier = z.infer<typeof ChatModifierSchema>;

export const ChatSegmentSchema = z.tuple([ChatModifierSchema, z.string()]);
export type IChatSegment = z.infer<typeof ChatSegmentSchema>;

export const ChatTypeSchema = z.enum(['chat', 'me', 'emote', 'ooc']);
export type IChatType = z.infer<typeof ChatTypeSchema>;

export const ClientMessageSchema = z.discriminatedUnion('type', [
	z.object({
		type: z.enum(['me', 'emote']),
		parts: z.array(ChatSegmentSchema),
	}),
	z.object({
		type: z.literal('ooc'),
		parts: z.array(ChatSegmentSchema),
		to: CharacterIdSchema.array().optional(),
	}),
	z.object({
		type: z.literal('chat'),
		parts: z.array(ChatSegmentSchema),
		to: CharacterIdSchema.array().optional(),
	}),
]);
export type IClientMessage = z.infer<typeof ClientMessageSchema>;

export function CalculateChatMessagesLength(message: IClientMessage[], maxLength: number) {
	let length = 0;
	outer: for (const messagePart of message) {
		for (const part of messagePart.parts) {
			length += part[1].length;
			if (length > maxLength) {
				break outer;
			}
		}
	}
	return length;
}

export const ClientChatMessagesSchema = z.array(ClientMessageSchema).superRefine((val, ctx) => {
	if (CalculateChatMessagesLength(val, LIMIT_CHAT_MESSAGE_LENGTH) > LIMIT_CHAT_MESSAGE_LENGTH) {
		ctx.addIssue({
			code: 'custom',
			message: `Message is too long, maximum length is ${LIMIT_CHAT_MESSAGE_LENGTH}`,
		});
	}
});

export const ChatMessageChatCharacterSchema = z.object({
	id: CharacterIdSchema,
	name: z.string(),
	labelColor: HexColorStringSchema,
});
export type ChatMessageChatCharacter = z.infer<typeof ChatMessageChatCharacterSchema>;

const ChatMessageChatBaseDataSchema = ChatReceivedMessageBaseSchema.extend({
	id: z.number(),
	insertId: z.number().optional(),
	/** Room the message was said in */
	room: RoomIdSchema,
	from: ChatMessageChatCharacterSchema,
});

export const ChatMessageChatSchema = z.discriminatedUnion('type', [
	ChatMessageChatBaseDataSchema.extend({
		type: z.enum(['me', 'emote']),
		parts: z.array(ChatSegmentSchema),
	}),
	ChatMessageChatBaseDataSchema.extend({
		type: z.literal('ooc'),
		parts: z.array(ChatSegmentSchema),
		to: ChatMessageChatCharacterSchema.array().optional(),
	}),
	ChatMessageChatBaseDataSchema.extend({
		type: z.literal('chat'),
		parts: z.array(ChatSegmentSchema),
		to: ChatMessageChatCharacterSchema.array().optional(),
	}),
]);
export type ChatMessageChat = z.infer<typeof ChatMessageChatSchema>;

export const ChatMessageDeletedSchema = ChatReceivedMessageBaseSchema.extend({
	type: z.literal('deleted'),
	id: z.number(),
	from: CharacterIdSchema,
});
export type ChatMessageDeleted = z.infer<typeof ChatMessageDeletedSchema>;

export const ChatMessageActionSchema = ChatReceivedMessageBaseSchema.extend({
	type: z.enum(['action', 'serverMessage']),
	/** id to be looked up in message translation database */
	id: ChatActionIdSchema,
	/** The array of characters the message should be sent to */
	sendTo: CharacterIdSchema.array().optional(),
	/** Rooms for which the action message is relevant. Messages concerning the whole space should set this to `null`. */
	rooms: RoomIdSchema.array().nullable(),
	data: z.object({
		/** Used to generate specific dictionary entries, acts as source */
		character: IChatMessageActionTargetCharacterSchema.optional(),
		/** Used to generate specific dictionary entries, defaults to `character` */
		target: IChatMessageActionTargetSchema.optional(),
		/** The item this message is about */
		item: IChatMessageActionItemSchema.optional(),
		/** The previous state of item this message is about, defaults to `item` */
		itemPrevious: IChatMessageActionItemSchema.optional(),
		/** Path to the container possible on `character` that `item` or `itemPrevious` are in */
		itemContainerPath: IChatMessageActionContainerPathSchema.optional(),
	}).optional(),
	dictionary: z.partialRecord(z.string(), z.string()).optional(),
});
export type ChatMessageAction = z.infer<typeof ChatMessageActionSchema>;

export const ChatMessageSchema = z.union([ChatMessageChatSchema, ChatMessageActionSchema, ChatMessageDeletedSchema, ChatMessageActionLogSchema]);
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ChatMessageDirectoryActionSchema = ChatMessageActionSchema.omit({ time: true, data: true, rooms: true }).extend({
	/** Time the message was sent, guaranteed to be unique from Directory; not necessarily the final one */
	directoryTime: z.number(),
	data: z.object({
		character: CharacterIdSchema.optional(),
		targetCharacter: CharacterIdSchema.optional(),
	}).optional(),
});
export type ChatMessageDirectoryAction = z.infer<typeof ChatMessageDirectoryActionSchema>;

export const ChatCharacterStatusSchema = z.enum(['none', 'typing', 'whispering', 'afk']);
export type ChatCharacterStatus = z.infer<typeof ChatCharacterStatusSchema>;
/** Status as it is sent to the server */
export type ChatCharacterFullStatus = {
	/** The actual status */
	status: ChatCharacterStatus;
	/** Targets who can see the status. Others receive 'none'. */
	targets?: readonly CharacterId[];
};

export const LONGDESC_RAW = ' Symbols that usually apply formatting (e.g. _italics_) will be displayed as plaintext without any formatting.';
export const LONGDESC_THIRD_PERSON = ' It describes events in third-person instead of representing spoken words.';
export const LONGDESC_TOGGLE_MODE = ' Exclude the [message] argument to toggle this mode on/off for all messages.';

export type IChatTypeDetails = {
	commandKeywords: [string, ...string[]];
	description: string;
	longDescription: string;
};

export const ChatTypeDetails: Record<IChatType, IChatTypeDetails> = {
	'chat': {
		commandKeywords: ['say', 'chat'],
		description: 'standard message',
		longDescription: 'Sends a spoken message to everyone in the room.',
	},
	'ooc': {
		commandKeywords: ['ooc', 'o'],
		description: 'out-of-character (OOC) message',
		longDescription: 'Sends an (( OOC )) message which ignores effects like muffling/deafening and is used for communicating as the user in front of the screen.' + LONGDESC_TOGGLE_MODE,
	},
	'me': {
		commandKeywords: ['me', 'm', 'action'],
		description: 'action message',
		longDescription: 'Sends an *action* message, automatically including your name at the beginning.' + LONGDESC_THIRD_PERSON + LONGDESC_TOGGLE_MODE,
	},
	'emote': {
		commandKeywords: ['emote', 'e'],
		description: 'action message without your name',
		longDescription: 'Sends an **emote* message, without including your name.' + LONGDESC_THIRD_PERSON + LONGDESC_TOGGLE_MODE,
	},
};
