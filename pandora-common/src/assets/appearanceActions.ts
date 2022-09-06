import { z } from 'zod';
import { CharacterId, CharacterIdSchema } from '../character';
import { AssertNever } from '../utility';
import { HexColorStringSchema } from '../validation';
import { Appearance, ArmsPose, CharacterView, AppearanceActionHandler, AppearanceActionProcessingContext } from './appearance';
import { AssetManager } from './assetManager';
import { AssetIdSchema } from './definitions';
import { ItemIdSchema } from './item';
import { CharacterRestrictionsManager } from '../character/restrictionsManager';

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

export const AppearanceActionSchema = z.discriminatedUnion('type', [
	AppearanceActionCreateSchema,
	AppearanceActionDeleteSchema,
	AppearanceActionPose,
	AppearanceActionBody,
	AppearanceActionSetView,
	AppearanceActionMove,
	AppearanceActionColor,
]);
export type AppearanceAction = z.infer<typeof AppearanceActionSchema>;

export interface AppearanceActionContext {
	player: CharacterId;
	characters: Map<CharacterId, Appearance>;
	// TODO
	roomInventory: null;
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

	const player = new CharacterRestrictionsManager(context.player, playerAppearance);

	const processingContext: AppearanceActionProcessingContext = {
		player: action.target,
		sourceCharacter: context.player,
		actionHandler: context.actionHandler,
	};

	switch (action.type) {
		// Create and equip an item
		case 'create': {
			const asset = assetManager.getAssetById(action.asset);
			if (!asset)
				return false;
			// Must result in valid appearance
			if (!targetAppearance.allowCreateItem(action.itemId, asset))
				return false;
			// Player equipping the item must be able to use their hands
			if (!player.canUseHands())
				return false;
			// If equipping on self, the asset must allow self-equip
			if (context.player === action.target && !(asset.definition.allowSelfEquip ?? true))
				return false;

			if (!dryRun) {
				targetAppearance.createItem(action.itemId, asset, processingContext);
			}
			return true;
		}
		// Unequip and delete an item
		case 'delete': {
			// Must result in valid appearance
			if (!targetAppearance.allowRemoveItem(action.itemId))
				return false;
			// Player removing the item must be able to use their hands
			if (!player.canUseHands())
				return false;

			if (!dryRun) {
				targetAppearance.removeItem(action.itemId, processingContext);
			}
			return true;
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
		// Moves an item within inventory, reordering the worn order
		case 'move':
			// Must result in valid appearance
			if (!targetAppearance.allowMoveItem(action.itemId, action.shift))
				return false;
			// Player moving the item must be able to use their hands
			if (!player.canUseHands())
				return false;

			if (!dryRun) {
				targetAppearance.moveItem(action.itemId, action.shift, processingContext);
			}
			return true;
		// Changes the color of an item
		case 'color':
			// Must result in valid appearance
			if (!targetAppearance.allowColorItem(action.itemId, action.color))
				return false;
			// Player coloring the item must be able to use their hands
			if (!player.canUseHands())
				return false;

			if (!dryRun) {
				targetAppearance.colorItem(action.itemId, action.color, processingContext);
			}
			return true;
		default:
			AssertNever(action);
	}
}
