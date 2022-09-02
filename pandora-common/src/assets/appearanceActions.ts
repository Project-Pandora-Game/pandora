import { z } from 'zod';
import { CharacterId, CharacterIdSchema } from '../character';
import { AssertNever } from '../utility';
import { Appearance, ArmsPose, CharacterView } from './appearance';
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

export const AppearanceActionSchema = z.discriminatedUnion('type', [
	AppearanceActionCreateSchema,
	AppearanceActionDeleteSchema,
	AppearanceActionPose,
	AppearanceActionBody,
	AppearanceActionSetView,
]);
export type AppearanceAction = z.infer<typeof AppearanceActionSchema>;

export interface AppearanceActionContext {
	player: CharacterId;
	characters: Map<CharacterId, Appearance>;
	// TODO
	roomInventory: null;
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

	switch (action.type) {
		case 'create': {
			const asset = assetManager.getAssetById(action.asset);
			if (!asset)
				return false;
			if (!appearance.allowCreateItem(action.itemId, asset))
				return false;
			if (!dryRun) {
				appearance.createItem(action.itemId, asset);
			}
			return true;
		}
		case 'delete': {
			if (!appearance.allowRemoveItem(action.itemId))
				return false;

			if (!dryRun) {
				appearance.removeItem(action.itemId);
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
		default:
			AssertNever(action);
	}
}
