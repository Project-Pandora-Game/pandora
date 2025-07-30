import { z } from 'zod';
import { CharacterId, CharacterIdSchema } from '../character/characterTypes.ts';
import type { CharacterRestrictionsManager } from '../character/restrictionsManager.ts';
import type { ChatActionId, IChatMessageAction, IChatMessageActionTargetCharacter, IChatMessageActionTargetRoom } from '../chat/index.ts';
import type { GameLogicCharacter } from '../gameLogic/character/index.ts';
import { LIMIT_ROOM_NAME_LENGTH, LIMIT_ROOM_NAME_PATTERN } from '../inputLimits.ts';
import type { ActionSpaceContext } from '../space/space.ts';
import { ZodTemplateString, ZodTruncate } from '../validation.ts';
import { ItemIdSchema, type Item } from './item/base.ts';
import type { AppearanceItems } from './item/items.ts';
import type { AssetFrameworkCharacterState } from './state/characterState.ts';
import type { AssetFrameworkRoomState } from './state/roomState.ts';

export const RoomIdSchema = ZodTemplateString<`room:${string}`>(z.string(), /^room:/);
export type RoomId = z.infer<typeof RoomIdSchema>;

export const RoomNameSchema = z.string().regex(LIMIT_ROOM_NAME_PATTERN).transform(ZodTruncate(LIMIT_ROOM_NAME_LENGTH));

export const ItemContainerPathSchema = z.array(
	z.object({
		item: ItemIdSchema,
		module: z.string(),
	}),
).readonly();
export type ItemContainerPath = z.infer<typeof ItemContainerPathSchema>;

export const ItemPathSchema = z.object({
	/** Path to module containing the item */
	container: ItemContainerPathSchema,
	/** The item inside container */
	itemId: ItemIdSchema,
});
export type ItemPath = z.infer<typeof ItemPathSchema>;

export const CharacterSelectorSchema = z.object({
	/** The item is to be found on character */
	type: z.literal('character'),
	characterId: CharacterIdSchema,
});
export type ActionCharacterSelector = z.infer<typeof CharacterSelectorSchema>;

export const RoomSelectorSchema = z.object({
	/** The item is to be found in room inventory */
	type: z.literal('room'),
	roomId: RoomIdSchema,
});
export type ActionRoomSelector = z.infer<typeof RoomSelectorSchema>;

export const ActionTargetSelectorSchema = z.discriminatedUnion('type', [CharacterSelectorSchema, RoomSelectorSchema]);
export type ActionTargetSelector = z.infer<typeof ActionTargetSelectorSchema>;

export interface ActionHandlerMessageTemplate extends Omit<NonNullable<IChatMessageAction['data']>, 'character' | 'target'> {
	id: ChatActionId;
	/** Custom text is used instead of the `id` lookup result, if specified */
	customText?: string;
	dictionary?: Record<string, string>;
}
export type ActionMessageTemplateHandler = (message: ActionHandlerMessageTemplate) => void;

export type ActionHandlerMessageTargetCharacter = Pick<IChatMessageActionTargetCharacter, 'type' | 'id'>;
export type ActionHandlerMessageTargetRoom = IChatMessageActionTargetRoom;
export type ActionHandlerMessageTarget = ActionHandlerMessageTargetCharacter | ActionHandlerMessageTargetRoom;

export interface ActionHandlerMessageWithTarget extends ActionHandlerMessageTemplate {
	target?: ActionHandlerMessageTarget;
}

export interface ActionHandlerMessage extends ActionHandlerMessageWithTarget {
	character?: ActionHandlerMessageTargetCharacter;
	sendTo?: CharacterId[];
}
export type ActionHandler = (message: ActionHandlerMessage) => void;

interface ActionTargetBase {
	getItem(path: ItemPath): Item | undefined;
	getAllItems(): AppearanceItems;
}

export interface ActionTargetCharacter extends ActionTargetBase {
	readonly type: 'character';
	readonly character: GameLogicCharacter;
	readonly characterState: AssetFrameworkCharacterState;

	getRestrictionManager(spaceContext: ActionSpaceContext): CharacterRestrictionsManager;
	getCurrentRoom(): AssetFrameworkRoomState | null;
}

export interface ActionTargetRoomInventory extends ActionTargetBase {
	readonly type: 'roomInventory';
}

export type ActionTarget = ActionTargetCharacter | ActionTargetRoomInventory;
