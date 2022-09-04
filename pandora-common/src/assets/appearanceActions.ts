import { z } from 'zod';
import { CharacterId, CharacterIdSchema } from '../character';
import { AssertNever } from '../utility';
import { HexColorStringSchema } from '../validation';
import { Appearance, ArmsPose, CharacterView, AppearanceActionHandler, AppearanceActionProcessingContext } from './appearance';
import { AssetManager } from './assetManager';
import { AssetIdSchema } from './definitions';
import { ItemIdSchema } from './item';

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
	pose: z.record(z.string(), z.number()),
	armsPose: z.nativeEnum(ArmsPose).optional(),
});

export const AppearanceActionBody = z.object({
	type: z.literal('body'),
	target: CharacterIdSchema,
	pose: z.record(z.string(), z.number()),
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
	const appearance = context.characters.get(action.target);
	if (!appearance)
		return false;
	const processingContext: AppearanceActionProcessingContext = {
		player: action.target,
		sourceCharacter: context.player,
		actionHandler: context.actionHandler,
	};

	switch (action.type) {
		case 'create': {
			const asset = assetManager.getAssetById(action.asset);
			if (!asset)
				return false;
			if (!appearance.allowCreateItem(action.itemId, asset))
				return false;
			if (!dryRun) {
				appearance.createItem(action.itemId, asset, processingContext);
			}
			return true;
		}
		case 'delete': {
			if (!appearance.allowRemoveItem(action.itemId))
				return false;

			if (!dryRun) {
				appearance.removeItem(action.itemId, processingContext);
			}
			return true;
		}
		case 'body':
			if (context.player !== action.target)
				return false;
		// falls through
		case 'pose':
			if (!dryRun) {
				appearance.importPose(action.pose, action.type, false);
				if ('armsPose' in action && action.armsPose != null) {
					appearance.setArmsPose(action.armsPose);
				}
			}
			return true;
		case 'setView':
			if (!dryRun) {
				appearance.setView(action.view);
			}
			return true;
		case 'move':
			if (!appearance.allowMoveItem(action.itemId, action.shift))
				return false;

			if (!dryRun) {
				appearance.moveItem(action.itemId, action.shift, processingContext);
			}
			return true;
		case 'color':
			if (!appearance.allowColorItem(action.itemId, action.color))
				return false;

			if (!dryRun) {
				appearance.colorItem(action.itemId, action.color, processingContext);
			}
			return true;
		default:
			AssertNever(action);
	}
}
