import { z } from 'zod';
import { CharacterId, CharacterIdSchema } from '../character';
import { AssertNever } from '../utility';
import { Appearance } from './appearance';
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

export const AppearanceActionSchema = z.discriminatedUnion('type', [AppearanceActionCreateSchema, AppearanceActionDeleteSchema]);
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
	if (action.type === 'create') {
		const appearance = context.characters.get(action.target);
		if (!appearance)
			return false;
		const asset = assetManager.getAssetById(action.asset);
		if (!asset)
			return false;
		if (!appearance.allowCreateItem(action.itemId, asset))
			return false;

		if (!dryRun) {
			appearance.createItem(action.itemId, asset);
		}
	} else if (action.type === 'delete') {
		const appearance = context.characters.get(action.target);
		if (!appearance)
			return false;
		if (!appearance.allowRemoveItem(action.itemId))
			return false;

		if (!dryRun) {
			appearance.removeItem(action.itemId);
		}
	} else {
		AssertNever(action);
	}
	return true;
}
