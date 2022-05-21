import { CharacterId, IsCharacterId } from '../character';
import { AssertNever } from '../utility';
import { CreateObjectValidator, CreateOneOfValidator } from '../validation';
import { Appearance } from './appearance';
import { AssetManager } from './assetManager';
import { AssetId, IsAssetId } from './definitions';
import { IsItemId, ItemId } from './item';

interface AppearanceActionBase {
	type: string;
}

export interface AppearanceActionCreate extends AppearanceActionBase {
	type: 'create';
	target: CharacterId;
	itemId: ItemId;
	asset: AssetId;
}

export const IsAppearanceActionCreate = CreateObjectValidator<AppearanceActionCreate>({
	type: CreateOneOfValidator('create'),
	target: IsCharacterId,
	itemId: IsItemId,
	asset: IsAssetId,
});

export interface AppearanceActionDelete extends AppearanceActionBase {
	type: 'delete';
	target: CharacterId;
	itemId: ItemId;
}

export const IsAppearanceActionDelete = CreateObjectValidator<AppearanceActionDelete>({
	type: CreateOneOfValidator('delete'),
	target: IsCharacterId,
	itemId: IsItemId,
});

export type AppearanceAction =
	AppearanceActionCreate |
	AppearanceActionDelete;

const AppearanceActionValidators: ((value: unknown) => boolean)[] = [
	IsAppearanceActionCreate,
	IsAppearanceActionDelete,
];

export function IsAppearanceAction(value: unknown): value is AppearanceAction {
	return AppearanceActionValidators.some((i) => i(value));
}

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
