import { z } from 'zod';
import { Logger } from '../logging';
import { AppearanceRootManipulator } from './appearanceHelpers';
import type { ActionProcessingContext, ItemPath, RoomActionTargetRoomInventory } from './appearanceTypes';
import { AppearanceItems, AppearanceValidationResult } from './appearanceValidation';
import { AssetManager } from './assetManager';
import { Item, ItemBundleSchema } from './item';
import { RoomInventoryLoadAndValidate, ValidateRoomInventoryItems } from './roomValidation';

export const RoomInventoryBundleSchema = z.object({
	items: z.array(ItemBundleSchema),
});

export type RoomInventoryBundle = z.infer<typeof RoomInventoryBundleSchema>;

export const ROOM_INVENTORY_BUNDLE_DEFAULT: RoomInventoryBundle = {
	items: [],
};

export class RoomInventory implements RoomActionTargetRoomInventory {
	public readonly type = 'roomInventory';

	protected assetManager: AssetManager;
	public onChangeHandler: (() => void) | undefined;

	private items: AppearanceItems = [];

	constructor(assetManager: AssetManager, onChange?: () => void) {
		this.assetManager = assetManager;
		this.importFromBundle(ROOM_INVENTORY_BUNDLE_DEFAULT);
		this.onChangeHandler = onChange;
	}

	public exportToBundle(): RoomInventoryBundle {
		return {
			items: this.items.map((item) => item.exportToBundle()),
		};
	}

	public importFromBundle(bundle: RoomInventoryBundle, logger?: Logger, assetManager?: AssetManager): void {
		// Simple migration
		bundle = {
			...ROOM_INVENTORY_BUNDLE_DEFAULT,
			...bundle,
		};
		if (assetManager && this.assetManager !== assetManager) {
			this.assetManager = assetManager;
		}

		// Load all items
		const loadedItems: Item[] = [];
		for (const itemBundle of bundle.items) {
			// Load asset and skip if unknown
			const asset = this.assetManager.getAssetById(itemBundle.asset);
			if (asset === undefined) {
				logger?.warning(`Skipping unknown asset ${itemBundle.asset}`);
				continue;
			}

			const item = this.assetManager.createItem(itemBundle.id, asset, itemBundle, logger);
			loadedItems.push(item);
		}

		// Validate and add all items
		const newItems = RoomInventoryLoadAndValidate(this.assetManager, loadedItems, logger);

		if (!ValidateRoomInventoryItems(this.assetManager, newItems).success) {
			throw new Error('Invalid appearance after load');
		}

		this.items = newItems;

		this.onChange();
	}

	public reloadAssetManager(assetManager: AssetManager, logger?: Logger) {
		if (this.assetManager === assetManager)
			return;
		const bundle = this.exportToBundle();
		this.assetManager = assetManager;
		this.importFromBundle(bundle, logger);
	}

	public getAssetManager(): AssetManager {
		return this.assetManager;
	}

	protected onChange(): void {
		this.onChangeHandler?.();
	}

	public getItem({ container, itemId }: ItemPath): Item | undefined {
		let current = this.items;
		for (const step of container) {
			const item = current.find((it) => it.id === step.item);
			if (!item)
				return undefined;
			current = item.getModuleItems(step.module);
		}
		return current.find((it) => it.id === itemId);
	}

	public getAllItems(): readonly Item[] {
		return this.items;
	}

	public getManipulator(): AppearanceRootManipulator {
		return new AppearanceRootManipulator(this.assetManager, this.items, false);
	}

	public commitChanges(manipulator: AppearanceRootManipulator, context: ActionProcessingContext): AppearanceValidationResult {
		const newItems = manipulator.getRootItems();

		// Validate
		const r = ValidateRoomInventoryItems(this.assetManager, newItems);
		if (!r.success)
			return r;

		if (context.dryRun)
			return { success: true };

		this.items = newItems;
		this.onChange();

		for (const message of manipulator.getAndClearPendingMessages()) {
			context.actionHandler?.({
				...message,
				character: context.sourceCharacter ? {
					type: 'character',
					id: context.sourceCharacter,
				} : undefined,
				target: {
					type: 'roomInventory',
				},
			});
		}

		return { success: true };
	}

}
