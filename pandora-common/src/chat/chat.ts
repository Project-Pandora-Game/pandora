import * as z from 'zod';
import { RoomIdSchema, type RoomId } from '../assets/appearanceTypes.ts';
import { VirtualBotCharacterSchema, type VirtualBotCharacter } from '../bots/botBaseTypes.ts';
import { CharacterId, CharacterIdSchema } from '../character/characterTypes.ts';
import { LIMIT_CHAT_MESSAGE_LENGTH } from '../inputLimits.ts';
import { HexColorStringSchema, type HexColorString } from '../validation.ts';
import { ChatMessageActionLogSchema, type ChatMessageActionLog } from './actionLog.ts';
import { ChatActionIdSchema } from './chatActions.ts';
import { ChatReceivedMessageBaseSchema, IChatMessageActionAccountSchema, IChatMessageActionBotSchema, IChatMessageActionContainerPathSchema, IChatMessageActionItemSchema, IChatMessageActionTargetCharacterSchema, IChatMessageActionTargetSchema } from './chatCommon.ts';

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

/** A chat NPC (bot) styling the message */
export interface ChatMessageChatNPC {
	/** Mark that this is from a bot */
	id: VirtualBotCharacter;
	/** NPC name for the message. */
	name: string;
	/** Label color for the message. */
	labelColor: HexColorString;
}
export const ChatMessageChatNPCSchema: z.ZodType<ChatMessageChatNPC> = z.object({
	id: VirtualBotCharacterSchema,
	name: z.string(),
	labelColor: HexColorStringSchema,
});

const ChatMessageChatBaseDataSchema = ChatReceivedMessageBaseSchema.extend({
	id: z.number(),
	insertId: z.number().optional(),
	/** Room the message was said in. `null` means space-wide message (only sent by bots). */
	room: RoomIdSchema.nullable(),
	from: z.union([ChatMessageChatCharacterSchema, ChatMessageChatNPCSchema]),
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
	from: CharacterIdSchema.or(VirtualBotCharacterSchema),
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
		/** Used to generate specific dictionary entries, acts as source */
		account: z.discriminatedUnion('type', [IChatMessageActionAccountSchema, IChatMessageActionBotSchema]).optional(),
		/** Used to generate specific dictionary entries, defaults to `account` */
		accountTarget: IChatMessageActionAccountSchema.optional(),
	}).optional(),
	dictionary: z.partialRecord(z.string(), z.string()).optional(),
});
export type ChatMessageAction = z.infer<typeof ChatMessageActionSchema>;

export type ChatMessage = ChatMessageChat | ChatMessageAction | ChatMessageDeleted | ChatMessageActionLog;
export const ChatMessageSchema: z.ZodType<ChatMessage> = z.union([ChatMessageChatSchema, ChatMessageActionSchema, ChatMessageDeletedSchema, ChatMessageActionLogSchema]);

export const ChatMessageDirectoryActionSchema = ChatMessageActionSchema.omit({ time: true, data: true, rooms: true }).extend({
	/** Time the message was sent, guaranteed to be unique from Directory; not necessarily the final one */
	directoryTime: z.number(),
	data: z.object({
		character: CharacterIdSchema.optional(),
		targetCharacter: CharacterIdSchema.optional(),
		account: z.discriminatedUnion('type', [IChatMessageActionAccountSchema, IChatMessageActionBotSchema]).optional(),
		accountTarget: IChatMessageActionAccountSchema.optional(),
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

/** A single message sent by a bot. */
export type BotChatMessage =
	| {
		/** Type of this message: Standard chat message. */
		type: 'chat';
		/** Contents of the message as plain string or formatted segment list. */
		message: string | IChatSegment[];
		/** A virtual character this message is being sent as. */
		as: ChatMessageChatNPC;
		/** Which room is the message comming from. If unspecified, the message is space-wide. */
		room?: RoomId;
		/** If specified, then this message is a whisper that only the specified characters will see. */
		to?: CharacterId[];
	}
	| {
		/** Type of this message: Out-Of-Character message. */
		type: 'ooc';
		/** Contents of the message as plain string or formatted segment list. */
		message: string | IChatSegment[];
		/** A virtual character this message is being sent as. */
		as: ChatMessageChatNPC;
		/** Which room is the message comming from. If unspecified, the message is space-wide. */
		room?: RoomId;
		/** If specified, then this message is a whisper that only the specified characters will see. */
		to?: CharacterId[];
	}
	| {
		/** Type of this message: Emote (me = Emote with name auto-inserted). */
		type: 'emote' | 'me';
		/** Contents of the message as plain string or formatted segment list. */
		message: string | IChatSegment[];
		/** A virtual character this message is being sent as. */
		as: ChatMessageChatNPC;
		/** Which room is the message comming from. If unspecified, the message is space-wide. */
		room?: RoomId;
	};
/** A single message sent by a bot. */
export const BotChatMessageSchema: z.ZodType<BotChatMessage> = z.discriminatedUnion('type', [
	z.object({
		type: z.literal('chat'),
		message: z.union([z.string(), ChatSegmentSchema.array()]),
		as: ChatMessageChatNPCSchema,
		room: RoomIdSchema.optional(),
		to: CharacterIdSchema.array().optional(),
	}),
	z.object({
		type: z.literal('ooc'),
		message: z.union([z.string(), ChatSegmentSchema.array()]),
		as: ChatMessageChatNPCSchema,
		room: RoomIdSchema.optional(),
		to: CharacterIdSchema.array().optional(),
	}),
	z.object({
		type: z.enum(['me', 'emote']),
		message: z.union([z.string(), ChatSegmentSchema.array()]),
		as: ChatMessageChatNPCSchema,
		room: RoomIdSchema.optional(),
	}),
]);

/**
 * An identifiable batch of chat messages sent by bot.
 */
export interface BotChatMessageEnvelope {
	messages: BotChatMessage[];
	/**
	 * Increasing ID of the message. Must be strictly larger than the previous sent message in order for the envelope to sent.
	 *
	 * IDs that are smaller than or equal to previously seen id are skipped
	 * (this makes chat message send idempotent - if it fails once you can retry it without risking duplicate message send).
	 *
	 * We recommend basing this off of current time,
	 * adjusted to be strictly increasing if sending multiple envelopes in a single millisecond.
	 */
	id: number;
	/**
	 * If specified, then this envelope REPLACES envelope with the specified id.
	 * Use with empty `messages` to delete previous message.
	 *
	 * Unlike client, bot has no limitation on how recent messages can be edited.
	 */
	editId?: number;
}
export const BotChatMessageEnvelopeSchema: z.ZodType<BotChatMessageEnvelope> = z.object({
	messages: BotChatMessageSchema.array(),
	id: z.number().min(0),
	editId: z.number().min(0).optional(),
});
