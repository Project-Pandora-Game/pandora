import * as z from 'zod';
import { RoomIdSchema } from '../assets/appearanceTypes.ts';
import { AssetIdSchema } from '../assets/base.ts';
import { ItemIdSchema } from '../assets/item/base.ts';
import { CharacterIdSchema } from '../character/characterTypes.ts';
import { PronounKeySchema } from '../character/pronouns.ts';
import { HexColorStringSchema } from '../validation.ts';

export const ChatReceivedMessageBaseSchema = z.object({
	/** Time the message was sent, guaranteed to be unique */
	time: z.number(),
});
export type ChatReceivedMessageBase = z.infer<typeof ChatReceivedMessageBaseSchema>;

export const IChatMessageActionTargetCharacterSchema = z.object({
	type: z.literal('character'),
	id: CharacterIdSchema,
	name: z.string(),
	pronoun: PronounKeySchema,
	labelColor: HexColorStringSchema,
});
export type IChatMessageActionTargetCharacter = z.infer<typeof IChatMessageActionTargetCharacterSchema>;

export const IChatMessageActionItemSchema = z.object({
	id: ItemIdSchema,
	assetId: AssetIdSchema,
	itemName: z.string(),
});
export type IChatMessageActionItem = z.infer<typeof IChatMessageActionItemSchema>;

export const IChatMessageActionContainerPathSchema = z.object({
	id: ItemIdSchema,
	assetId: AssetIdSchema,
	itemName: z.string(),
	module: z.string(),
}).array();
export type IChatMessageActionContainerPath = z.infer<typeof IChatMessageActionContainerPathSchema>;

export const IChatMessageActionTargetRoomSchema = z.object({
	type: z.literal('room'),
	roomId: RoomIdSchema,
});
export type IChatMessageActionTargetRoom = z.infer<typeof IChatMessageActionTargetRoomSchema>;

export const IChatMessageActionTargetSchema = z.union([IChatMessageActionTargetCharacterSchema, IChatMessageActionTargetRoomSchema]);
export type IChatMessageActionTarget = z.infer<typeof IChatMessageActionTargetSchema>;
