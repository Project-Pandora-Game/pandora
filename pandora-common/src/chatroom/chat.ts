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

export type IChatRoomMessageChatCharacter = { id: CharacterId, name: string; labelColor: string; };
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

export type IChatRoomMessageActionCharacter = {
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

export type IChatRoomMessageAction = {
	type: 'action' | 'serverMessage';
	/** id to be looked up in message translation database */
	id: ChatActionId;
	/** Custom text is used instead of the `id` lookup result, if specified */
	customText?: string;
	data?: {
		/** Used to generate specific dictionary entries, acts as source */
		character?: IChatRoomMessageActionCharacter;
		/** Used to generate specific dictionary entries, defaults to `character` */
		targetCharacter?: IChatRoomMessageActionCharacter;
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

export const ChatRoomStatusSchema = z.enum(['none', 'typing', 'whisper', 'afk']);
export type IChatRoomStatus = z.infer<typeof ChatRoomStatusSchema>;

export type IChatTypeDetails = {
	commandKeywords: string[],
	description: string,
};

export const ChatTypeDetails: { [type in IChatType]: IChatTypeDetails; } = {
	'chat': {
		commandKeywords: ['say', 'chat'],
		description: 'standard message',
	},
	'ooc': {
		commandKeywords: ['ooc', 'o'],
		description: 'out-of-character (OOC) message',
	},
	'me': {
		commandKeywords: ['me', 'm', 'action'],
		description: 'action message',
	},
	'emote': {
		commandKeywords: ['emote', 'e'],
		description: 'action message without your name',
	},
};
