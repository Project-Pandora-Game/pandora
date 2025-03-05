import { z } from 'zod';
import type { ItemId } from '../assets';
import type { AssetId } from '../assets/base';
import { CharacterId, CharacterIdSchema } from '../character/characterTypes';
import type { PronounKey } from '../character/pronouns';
import { LIMIT_CHAT_MESSAGE_LENGTH } from '../inputLimits';
import type { HexColorString } from '../validation';
import { ChatActionId } from './chatActions';

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
		to: CharacterIdSchema.optional(),
	}),
	z.object({
		type: z.literal('chat'),
		parts: z.array(ChatSegmentSchema),
		to: CharacterIdSchema.optional(),
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
			code: z.ZodIssueCode.custom,
			message: `Message is too long, maximum length is ${LIMIT_CHAT_MESSAGE_LENGTH}`,
		});
	}
});

export type IChatMessageChatCharacter = { id: CharacterId; name: string; labelColor: string; };
export type IChatMessageChat = Omit<IClientMessage, 'from' | 'to'> & {
	id: number;
	insertId?: number;
} & ({
	type: 'me' | 'emote';
	from: IChatMessageChatCharacter;
} | {
	type: 'chat' | 'ooc';
	from: IChatMessageChatCharacter;
	to?: IChatMessageChatCharacter;
});

export type IChatMessageDeleted = {
	type: 'deleted';
	id: number;
	from: CharacterId;
};

export type IChatMessageActionTargetCharacter = {
	type: 'character';
	id: CharacterId;
	name: string;
	pronoun: PronounKey;
	labelColor: HexColorString;
};
export type IChatMessageActionItem = {
	id: ItemId;
	assetId: AssetId;
	itemName: string;
};
export type IChatMessageActionContainerPath = {
	id: ItemId;
	assetId: AssetId;
	itemName: string;
	module: string;
}[];

export type IChatMessageActionTargetRoomInventory = {
	type: 'roomInventory';
};

export type IChatMessageActionTarget = IChatMessageActionTargetCharacter | IChatMessageActionTargetRoomInventory;

export type IChatMessageAction = {
	type: 'action' | 'serverMessage';
	/** id to be looked up in message translation database */
	id: ChatActionId;
	/** Custom text is used instead of the `id` lookup result, if specified */
	customText?: string;
	/** The array of characters the message should be sent to */
	sendTo?: CharacterId[];
	data?: {
		/** Used to generate specific dictionary entries, acts as source */
		character?: IChatMessageActionTargetCharacter;
		/** Used to generate specific dictionary entries, defaults to `character` */
		target?: IChatMessageActionTarget;
		/** The item this message is about */
		item?: IChatMessageActionItem;
		/** The previous state of item this message is about, defaults to `item` */
		itemPrevious?: IChatMessageActionItem;
		/** Path to the container possible on `character` that `item` or `itemPrevious` are in */
		itemContainerPath?: IChatMessageActionContainerPath;
	};
	dictionary?: Record<string, string>;
};

export type IChatMessageBase = IChatMessageChat | IChatMessageAction | IChatMessageDeleted;
export type IChatMessage = IChatMessageBase & {
	/** Time the message was sent, guaranteed to be unique */
	time: number;
};

export type IChatMessageDirectoryAction = Omit<IChatMessageAction, 'data'> & {
	/** Time the message was sent, guaranteed to be unique from Directory; not necessarily the final one */
	directoryTime: number;
	data?: {
		character?: CharacterId;
		targetCharacter?: CharacterId;
	};
};

export const ChatCharacterStatusSchema = z.enum(['none', 'typing', 'whispering', 'afk']);
export type ChatCharacterStatus = z.infer<typeof ChatCharacterStatusSchema>;

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
