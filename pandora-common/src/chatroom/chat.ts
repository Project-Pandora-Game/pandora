import { z } from 'zod';
import type { AssetId } from '../assets';
import { CharacterId, CharacterIdSchema } from '../character';
import type { PronounKey } from '../character/pronouns';
import { ChatActionId } from './chatActions';

export const ChatModifierSchema = z.enum(['normal', 'bold', 'italic']);
export type IChatModifier = z.infer<typeof ChatModifierSchema>;

export const ChatSegmentSchema = z.tuple([ChatModifierSchema, z.string()]);
export type IChatSegment = z.infer<typeof ChatSegmentSchema>;

export const ChatTypeSchema = z.enum(['chat', 'me', 'emote', 'ooc']);
export type IChatType = z.infer<typeof ChatTypeSchema>;

export const ClientMessageSchema = z.object({
	type: z.enum(['me', 'emote']),
	parts: z.array(ChatSegmentSchema),
}).or(z.object({
	type: z.enum(['chat', 'ooc']),
	parts: z.array(ChatSegmentSchema),
	to: CharacterIdSchema.optional(),
}));
export type IClientMessage = z.infer<typeof ClientMessageSchema>;

export type IChatRoomMessageChatCharacter = { id: CharacterId; name: string; labelColor: string; };
export type IChatRoomMessageChat = Omit<IClientMessage, 'from' | 'to'> & {
	id: number;
	insertId?: number;
} & ({
	type: 'me' | 'emote';
	from: IChatRoomMessageChatCharacter;
} | {
	type: 'chat' | 'ooc';
	from: IChatRoomMessageChatCharacter;
	to?: IChatRoomMessageChatCharacter;
});

export type IChatRoomMessageDeleted = {
	type: 'deleted';
	id: number;
	from: CharacterId;
};

export type IChatRoomMessageActionTargetCharacter = {
	type: 'character';
	id: CharacterId;
	name: string;
	pronoun: PronounKey;
	labelColor: string;
};
export type IChatRoomMessageActionItem = {
	assetId: AssetId;
};
export type IChatroomMessageActionContainerPath = {
	assetId: AssetId;
	module: string;
}[];

export type IChatRoomMessageActionTargetRoomInventory = {
	type: 'roomInventory';
};

export type IChatRoomMessageActionTarget = IChatRoomMessageActionTargetCharacter | IChatRoomMessageActionTargetRoomInventory;

export type IChatRoomMessageAction = {
	type: 'action' | 'serverMessage';
	/** id to be looked up in message translation database */
	id: ChatActionId;
	/** Custom text is used instead of the `id` lookup result, if specified */
	customText?: string;
	/** The array of characters the message should be sent to */
	sendTo?: CharacterId[];
	data?: {
		/** Used to generate specific dictionary entries, acts as source */
		character?: IChatRoomMessageActionTargetCharacter;
		/** Used to generate specific dictionary entries, defaults to `character` */
		target?: IChatRoomMessageActionTarget;
		/** The item this message is about */
		item?: IChatRoomMessageActionItem;
		/** The previous state of item this message is about, defaults to `item` */
		itemPrevious?: IChatRoomMessageActionItem;
		/** Path to the container possible on `character` that `item` or `itemPrevious` are in */
		itemContainerPath?: IChatroomMessageActionContainerPath;
	};
	dictionary?: Record<string, string>;
};

export type IChatRoomMessageBase = IChatRoomMessageChat | IChatRoomMessageAction | IChatRoomMessageDeleted;
export type IChatRoomMessage = IChatRoomMessageBase & {
	/** Time the message was sent, guaranteed to be unique */
	time: number;
};

export type IChatRoomMessageDirectoryAction = Omit<IChatRoomMessageAction, 'data'> & {
	/** Time the message was sent, guaranteed to be unique from Directory; not necessarily the final one */
	directoryTime: number;
	data?: {
		character?: CharacterId;
		targetCharacter?: CharacterId;
	};
};

export const ChatRoomStatusSchema = z.enum(['none', 'typing', 'whispering', 'afk']);
export type IChatRoomStatus = z.infer<typeof ChatRoomStatusSchema>;

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
		longDescription: 'Sends an (( OOC )) message which ignores effects like muffling/deafening and is used for communicating as an aside from the main activity/discussion.' + LONGDESC_TOGGLE_MODE,
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
