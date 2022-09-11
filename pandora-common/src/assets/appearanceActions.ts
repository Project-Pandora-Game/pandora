import { z } from 'zod';
import { CharacterId, CharacterIdSchema } from '../character';
import { AssertNever } from '../utility';
import { HexColorStringSchema } from '../validation';
import { Appearance, ArmsPose, CharacterView, AppearanceActionHandler, AppearanceActionProcessingContext } from './appearance';
import { AssetManager } from './assetManager';
import { AssetIdSchema } from './definitions';
import { ItemIdSchema } from './item';
import { CharacterRestrictionsManager, ItemInteractionType } from '../character/restrictionsManager';
import { ItemModuleActionSchema } from './modules';
import { AppearanceActionRoomContext } from '../chatroom';

export const AppearanceActionCreateSchema = z.object({
	type: z.literal('create'),
	target: CharacterIdSchema,
	itemId: ItemIdSchema,
	asset: AssetIdSchema,
});
export type AppearanceActionCreate = z.infer<typeof AppearanceActionCreateSchema>;

export const AppearanceActionDeleteSchema = z.object({
	type: z.literal('delete'),
	target: CharacterIdSchema,
	itemId: ItemIdSchema,
});
export type AppearanceActionDelete = z.infer<typeof AppearanceActionDeleteSchema>;

export const AppearanceActionPose = z.object({
	type: z.literal('pose'),
	target: CharacterIdSchema,
	pose: z.record(z.string(), z.number().optional()),
	armsPose: z.nativeEnum(ArmsPose).optional(),
});

export const AppearanceActionBody = z.object({
	type: z.literal('body'),
	target: CharacterIdSchema,
	pose: z.record(z.string(), z.number().optional()),
});

export const AppearanceActionSetView = z.object({
	type: z.literal('setView'),
	target: CharacterIdSchema,
	view: z.nativeEnum(CharacterView),
});

export const AppearanceActionMove = z.object({
	type: z.literal('move'),
	target: CharacterIdSchema,
	itemId: ItemIdSchema,
	shift: z.number().int(),
});

export const AppearanceActionColor = z.object({
	type: z.literal('color'),
	target: CharacterIdSchema,
	itemId: ItemIdSchema,
	color: z.array(HexColorStringSchema),
});

export const AppearanceActionModuleAction = z.object({
	type: z.literal('moduleAction'),
	target: CharacterIdSchema,
	itemId: ItemIdSchema,
	module: z.string(),
	action: ItemModuleActionSchema,
});

export const AppearanceActionSchema = z.discriminatedUnion('type', [
	AppearanceActionCreateSchema,
	AppearanceActionDeleteSchema,
	AppearanceActionPose,
	AppearanceActionBody,
	AppearanceActionSetView,
	AppearanceActionMove,
	AppearanceActionColor,
	AppearanceActionModuleAction,
]);
export type AppearanceAction = z.infer<typeof AppearanceActionSchema>;

export interface AppearanceActionContext {
	player: CharacterId;
	characters: Map<CharacterId, Appearance>;
	room: AppearanceActionRoomContext | null;
	/** Handler for sending messages to chat */
	actionHandler?: AppearanceActionHandler;
}

export function DoAppearanceAction(
	action: AppearanceAction,
	context: AppearanceActionContext,
	assetManager: AssetManager,
	{
		dryRun = false,
	}: {
		dryRun?: boolean;
	} = {},
): boolean {
	const playerAppearance = context.characters.get(context.player);
	const targetAppearance = context.characters.get(action.target);
	if (!targetAppearance || !playerAppearance)
		return false;

	const player = new CharacterRestrictionsManager(context.player, playerAppearance, context.room);
	const target = new CharacterRestrictionsManager(action.target, targetAppearance, context.room);

	const processingContext: AppearanceActionProcessingContext = {
		player: action.target,
		sourceCharacter: context.player,
		actionHandler: context.actionHandler,
		dryRun,
	};

	switch (action.type) {
		// Create and equip an item
		case 'create': {
			const asset = assetManager.getAssetById(action.asset);
			if (!asset)
				return false;
			const item = targetAppearance.spawnItem(action.itemId, asset);
			// Player adding the item must be able to use it
			if (!player.canInteractWithItem(target, item, ItemInteractionType.ADD_REMOVE))
				return false;

			return targetAppearance.addItem(item, processingContext);
		}
		// Unequip and delete an item
		case 'delete': {
			// Player removing the item must be able to use it
			if (!player.canInteractWithItem(target, action.itemId, ItemInteractionType.ADD_REMOVE))
				return false;

			return targetAppearance.removeItem(action.itemId, processingContext);
		}
		// Moves an item within inventory, reordering the worn order
		case 'move': {
			// Player moving the item must be able to interact with the item
			if (!player.canInteractWithItem(target, action.itemId, ItemInteractionType.ADD_REMOVE))
				return false;

			return targetAppearance.moveItem(action.itemId, action.shift, processingContext);
		}
		// Changes the color of an item
		case 'color': {
			// Player coloring the item must be able to interact with the item
			if (!player.canInteractWithItem(target, action.itemId, ItemInteractionType.STYLING))
				return false;

			return targetAppearance.colorItem(action.itemId, action.color, processingContext);
		}
		// Module-specific action
		case 'moduleAction': {
			// Player doing the action must be able to interact with the item
			if (!player.canInteractWithItemModule(target, action.itemId, action.module))
				return false;

			return targetAppearance.moduleAction(action.itemId, action.module, action.action, processingContext);
		}
		// Resize body or change pose
		case 'body':
			if (context.player !== action.target)
				return false;
		// falls through
		case 'pose':
			if (!dryRun) {
				targetAppearance.importPose(action.pose, action.type, false);
				if ('armsPose' in action && action.armsPose != null) {
					targetAppearance.setArmsPose(action.armsPose);
				}
			}
			return true;
		// Changes view of the character - front or back
		case 'setView':
			if (!dryRun) {
				targetAppearance.setView(action.view);
			}
			return true;
		default:
			AssertNever(action);
	}
}
