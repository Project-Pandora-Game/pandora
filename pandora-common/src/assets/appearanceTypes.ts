import { z } from 'zod';
import { CharacterId, CharacterIdSchema } from '../character/characterTypes';
import { zTemplateString } from '../validation';
import type { ActionRoomContext, ChatActionId, IChatRoomMessageAction } from '../chatroom';
import type { AppearanceRootManipulator } from './appearanceHelpers';
import type { AppearanceValidationResult } from './appearanceValidation';
import type { Item } from './item';
import type { CharacterRestrictionsManager, ICharacterMinimalData } from '../character';

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

export interface ActionHandlerMessageTemplate extends Omit<NonNullable<IChatRoomMessageAction['data']>, 'character' | 'targetCharacter'> {
	id: ChatActionId;
	/** Custom text is used instead of the `id` lookup result, if specified */
	customText?: string;
	dictionary?: Record<string, string>;
}
export type ActionMessageTemplateHandler = (message: ActionHandlerMessageTemplate) => void;
export interface ActionHandlerMessage extends ActionHandlerMessageTemplate {
	character?: CharacterId;
	targetCharacter?: CharacterId;
	sendTo?: CharacterId[];
}
export type ActionHandler = (message: ActionHandlerMessage) => void;

export interface ActionProcessingContext {
	sourceCharacter?: CharacterId;
	actionHandler?: ActionHandler;
	dryRun?: boolean;
}

interface RoomActionTargetBase {
	getManipulator(): AppearanceRootManipulator;
	commitChanges(manipulator: AppearanceRootManipulator, context: ActionProcessingContext): AppearanceValidationResult;
	getItem(path: ItemPath): Item | undefined;
}

export interface RoomActionTargetCharacter extends RoomActionTargetBase {
	readonly type: 'character';
	readonly character: Readonly<ICharacterMinimalData>;
	getRestrictionManager(room: ActionRoomContext | null): CharacterRestrictionsManager;
}

export interface RoomActionTargetRoomInventory extends RoomActionTargetBase {
	readonly type: 'roomInventory';
}

export type RoomActionTarget = RoomActionTargetCharacter | RoomActionTargetRoomInventory;
