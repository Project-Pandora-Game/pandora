import { z } from 'zod';
import { CharacterId, CharacterIdSchema } from '../character/characterTypes';
import type { CharacterRestrictionsManager } from '../character/restrictionsManager';
import type { ChatActionId, IChatMessageAction, IChatMessageActionTargetCharacter, IChatMessageActionTargetRoomInventory } from '../chat';
import type { GameLogicCharacter } from '../gameLogic/character';
import type { ActionSpaceContext } from '../space/space';
import { ZodTemplateString } from '../validation';
import type { Item } from './item';
import type { AssetFrameworkCharacterState } from './state/characterState';

export const ItemIdSchema = ZodTemplateString<`i/${string}`>(z.string(), /^i\//);
export type ItemId = z.infer<typeof ItemIdSchema>;

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

export const RoomInventorySelectorSchema = z.object({
	/** The item is to be found in room inventory */
	type: z.literal('roomInventory'),
});

export const ActionTargetSelectorSchema = z.discriminatedUnion('type', [CharacterSelectorSchema, RoomInventorySelectorSchema]);
export type ActionTargetSelector = z.infer<typeof ActionTargetSelectorSchema>;

export interface ActionHandlerMessageTemplate extends Omit<NonNullable<IChatMessageAction['data']>, 'character' | 'target'> {
	id: ChatActionId;
	/** Custom text is used instead of the `id` lookup result, if specified */
	customText?: string;
	dictionary?: Record<string, string>;
}
export type ActionMessageTemplateHandler = (message: ActionHandlerMessageTemplate) => void;

export type ActionHandlerMessageTargetCharacter = Pick<IChatMessageActionTargetCharacter, 'type' | 'id'>;
export type ActionHandlerMessageTargetRoomInventory = IChatMessageActionTargetRoomInventory;
export type ActionHandlerMessageTarget = ActionHandlerMessageTargetCharacter | ActionHandlerMessageTargetRoomInventory;

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
}

export interface ActionTargetCharacter extends ActionTargetBase {
	readonly type: 'character';
	readonly character: GameLogicCharacter;
	readonly characterState: AssetFrameworkCharacterState;

	getRestrictionManager(spaceContext: ActionSpaceContext): CharacterRestrictionsManager;
}

export interface ActionTargetRoomInventory extends ActionTargetBase {
	readonly type: 'roomInventory';
}

export type ActionTarget = ActionTargetCharacter | ActionTargetRoomInventory;
