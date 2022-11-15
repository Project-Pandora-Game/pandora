import { z } from 'zod';
import { CharacterId, CharacterIdSchema } from '../character/characterTypes';
import { zTemplateString } from '../validation';
import type { ChatActionId, IChatRoomMessageActionItem } from '../chatroom';
import type { AppearanceRootManipulator } from './appearanceHelpers';
import type { AppearanceValidationResult } from './appearanceValidation';
import type { Item } from './item';

export const ItemIdSchema = zTemplateString<`i/${string}`>(z.string(), /^i\//);
export type ItemId = z.infer<typeof ItemIdSchema>;

export const ItemContainerPathSchema = z.array(
	z.object({
		item: ItemIdSchema,
		module: z.string(),
	}),
);
export type ItemContainerPath = z.infer<typeof ItemContainerPathSchema>;

export const ItemPathSchema = z.object({
	/** Path to module containing the item */
	container: ItemContainerPathSchema,
	/** The item inside container */
	itemId: ItemIdSchema,
});
export type ItemPath = z.infer<typeof ItemPathSchema>;

const RoomCharacterSelectorSchema = z.object({
	/** The item is to be found on character */
	type: z.literal('character'),
	characterId: CharacterIdSchema,
});

const RoomInventorySelectorSchema = z.object({
	/** The item is to be found in room inventory */
	type: z.literal('roomInventory'),
});

export const RoomTargetSelectorSchema = z.discriminatedUnion('type', [RoomCharacterSelectorSchema, RoomInventorySelectorSchema]);
export type RoomTargetSelector = z.infer<typeof RoomTargetSelectorSchema>;

export interface AppearanceActionHandlerMessageTemplate {
	id: ChatActionId;
	item?: IChatRoomMessageActionItem;
	itemPrevious?: IChatRoomMessageActionItem;
	dictionary?: Record<string, string>;
}
export interface AppearanceActionHandlerMessage extends AppearanceActionHandlerMessageTemplate {
	character?: CharacterId;
	targetCharacter?: CharacterId;
}
export type AppearanceActionHandler = (message: AppearanceActionHandlerMessage) => void;

export interface AppearanceActionProcessingContext {
	sourceCharacter?: CharacterId;
	actionHandler?: AppearanceActionHandler;
	dryRun?: boolean;
}

interface RoomActionTargetBase {
	getManipulator(): AppearanceRootManipulator;
	commitChanges(manipulator: AppearanceRootManipulator, context: AppearanceActionProcessingContext): AppearanceValidationResult;
	getItem(path: ItemPath): Item | undefined;
}

export interface RoomActionTargetCharacter extends RoomActionTargetBase {
	readonly type: 'character';
	characterId: CharacterId;
}

export interface RoomActionTargetRoomInventory extends RoomActionTargetBase {
	readonly type: 'roomInventory';
}

export type RoomActionTarget = RoomActionTargetCharacter | RoomActionTargetRoomInventory;
