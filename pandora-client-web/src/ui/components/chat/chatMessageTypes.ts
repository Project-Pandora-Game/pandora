import {
	ChatMessageActionLogSchema,
	ChatMessageActionSchema,
	ChatMessageChatSchema,
	ChatMessageDeletedSchema,
	RoomIdSchema,
	SpaceIdSchema,
} from 'pandora-common';
import type {
	ReactElement,
} from 'react';
import * as z from 'zod';

export const ChatMessageProcessedRoomDataSchema = z.object({
	id: RoomIdSchema,
	name: z.string(),
});
export type ChatMessageProcessedRoomData = z.infer<typeof ChatMessageProcessedRoomDataSchema>;

export const ChatDeletedMessageProcessedSchema = ChatMessageDeletedSchema.extend({
	/** The space this message was received in */
	spaceId: SpaceIdSchema.nullable(),
	/** Id of a room the player character was in when the message was received. */
	receivedRoomId: RoomIdSchema,
});
export type ChatDeletedMessageProcessed = z.infer<typeof ChatDeletedMessageProcessedSchema>;

export const ChatNormalMessageProcessedSchema = ChatMessageChatSchema.and(z.object({
	/** The space this message was received in */
	spaceId: SpaceIdSchema.nullable(),
	/** Room the message was said in */
	roomData: ChatMessageProcessedRoomDataSchema,
	/** Id of a room the player character was in when the message was received. */
	receivedRoomId: RoomIdSchema,
	edited: z.boolean().optional(),
	/** Identical action messages following one after another get combined into a single message to reduce spam. */
	repetitions: z.number().optional(),
}));
export type ChatNormalMessageProcessed = z.infer<typeof ChatNormalMessageProcessedSchema>;

export type ChatMessageProcessedDictionaryEntry = string | { text: string; rich: ReactElement; };
export type ChatMessageProcessedDictionary<TK extends string = string> = Partial<Record<TK, ChatMessageProcessedDictionaryEntry>>;

export const ChatActionMessagePreprocessedSchema = ChatMessageActionSchema.extend({
	/** The space this message was received in */
	spaceId: SpaceIdSchema.nullable(),
	/** Rooms for which the action message is relevant. Messages concerning the whole space should set this to `null`. */
	roomsData: ChatMessageProcessedRoomDataSchema.array().nullable(),
	/** Id of a room the player character was in when the message was received. */
	receivedRoomId: RoomIdSchema,
	/** Identical action messages following one after another get combined into a single message to reduce spam. */
	repetitions: z.number().optional(),
});
export type ChatActionMessagePreprocessed = z.infer<typeof ChatActionMessagePreprocessedSchema>;

export type ChatActionMessageProcessed = Omit<ChatActionMessagePreprocessed, 'dictionary'> & {
	dictionary?: ChatMessageProcessedDictionary;
};

export const ChatActionLogMessageProcessedSchema = ChatMessageActionLogSchema.extend({
	/** The space this message was received in */
	spaceId: SpaceIdSchema.nullable(),
});
export type ChatActionLogMessageProcessed = z.infer<typeof ChatActionLogMessageProcessedSchema>;

export const ChatMessagePreprocessedSchema = z.union([ChatNormalMessageProcessedSchema, ChatDeletedMessageProcessedSchema, ChatActionMessagePreprocessedSchema, ChatActionLogMessageProcessedSchema]);
export type ChatMessagePreprocessed = z.infer<typeof ChatMessagePreprocessedSchema>;

export function IsActionMessage(message: ChatMessagePreprocessed): message is ChatActionMessagePreprocessed {
	return message.type === 'action' || message.type === 'serverMessage';
}
