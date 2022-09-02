import { z } from 'zod';
import { Logger } from '../logging';
import { ShuffleArray } from '../utility';
import { AppearanceItems, AppearanceItemsFixBodypartOrder, ValidateAppearanceItems, ValidateAppearanceItemsPrefix } from './appearanceValidation';
import { Asset } from './asset';
import { AssetManager } from './assetManager';
import { AssetId } from './definitions';
import { BoneState, BoneType } from './graphics';
import { Item, ItemBundleSchema, ItemId } from './item';

export const BoneNameSchema = z.string();
export type BoneName = z.infer<typeof BoneNameSchema>;

export enum ArmsPose {
	FRONT,
	BACK,
}

export enum CharacterView {
	FRONT,
	BACK,
}

export const AppearanceBundleSchema = z.object({
	items: z.array(ItemBundleSchema),
	pose: z.record(BoneNameSchema, z.number()),
	handsPose: z.nativeEnum(ArmsPose),
	view: z.nativeEnum(CharacterView),
});

export type AppearanceBundle = z.infer<typeof AppearanceBundleSchema>;

export const APPEARANCE_BUNDLE_DEFAULT: AppearanceBundle = {
	items: [],
	pose: {},
	handsPose: ArmsPose.FRONT,
	view: CharacterView.FRONT,
};

export type AppearanceChangeType = 'items' | 'pose';

export class Appearance {
	private assetMananger: AssetManager;
	public onChangeHandler: ((changes: AppearanceChangeType[]) => void) | undefined;

	private items: AppearanceItems = [];
	private readonly pose = new Map<BoneName, BoneState>();
	private fullPose: readonly BoneState[] = [];
	private _armsPose: ArmsPose = APPEARANCE_BUNDLE_DEFAULT.handsPose;
	private _view: CharacterView = APPEARANCE_BUNDLE_DEFAULT.view;

	constructor(assetMananger: AssetManager, onChange?: (changes: AppearanceChangeType[]) => void) {
		this.assetMananger = assetMananger;
		this.importFromBundle(APPEARANCE_BUNDLE_DEFAULT);
		this.onChangeHandler = onChange;
	}

	protected makeItem(id: ItemId, asset: Asset): Item {
		return new Item(id, asset);
	}

	public exportToBundle(): AppearanceBundle {
		return {
			items: this.items.map((item) => item.exportToBundle()),
			pose: this.exportPose(),
			handsPose: this._armsPose,
			view: this._view,
		};
	}

	public importFromBundle(bundle: AppearanceBundle, logger?: Logger, assetManager?: AssetManager): void {
		// Simple migration
		bundle = {
			...APPEARANCE_BUNDLE_DEFAULT,
			...bundle,
		};
		if (assetManager && this.assetMananger !== assetManager) {
			this.assetMananger = assetManager;
		}

		// Load all items
		let loadedItems: Item[] = [];
		for (const itemBundle of bundle.items) {
			// Load asset and skip if unknown
			const asset = this.assetMananger.getAssetById(itemBundle.asset);
			if (asset === undefined) {
				logger?.warning(`Skipping unknown asset ${itemBundle.asset}`);
				continue;
			}

			const item = this.makeItem(itemBundle.id, asset);
			item.importFromBundle(itemBundle);
			loadedItems.push(item);
		}

		// Validate and add all items
		loadedItems = AppearanceItemsFixBodypartOrder(this.assetMananger, loadedItems).slice();
		let newItems: readonly Item[] = [];
		let currentBodypartIndex: number | null = this.assetMananger.bodyparts.length > 0 ? 0 : null;
		while (loadedItems.length > 0) {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			const itemToAdd = loadedItems.shift()!;
			// Check moving to next bodypart
			while (currentBodypartIndex !== null && itemToAdd.asset.definition.bodypart !== this.assetMananger.bodyparts[currentBodypartIndex].name) {
				const bodypart = this.assetMananger.bodyparts[currentBodypartIndex];

				// Check if we need to add required bodypart
				if (bodypart.required && !newItems.some((item) => item.asset.definition.bodypart === bodypart.name)) {
					// Find matching bodypart assets
					const possibleAssets = this.assetMananger
						.getAllAssets()
						.filter((asset) => asset.definition.bodypart === bodypart.name);

					ShuffleArray(possibleAssets);

					for (const asset of possibleAssets) {
						const tryFix = [...newItems, this.makeItem(`i/requiredbodypart/${bodypart.name}` as const, asset)];
						if (ValidateAppearanceItemsPrefix(this.assetMananger, tryFix)) {
							newItems = tryFix;
							break;
						}
					}
				}

				if (bodypart.required && !newItems.some((item) => item.asset.definition.bodypart === bodypart.name)) {
					throw new Error(`Failed to satisfy the requirement for '${bodypart.name}'`);
				}

				// Move to next bodypart or end validation if all are done
				currentBodypartIndex++;
				if (currentBodypartIndex >= this.assetMananger.bodyparts.length) {
					currentBodypartIndex = null;
				}
			}

			const tryItem = [...newItems, itemToAdd];
			if (!ValidateAppearanceItemsPrefix(this.assetMananger, tryItem)) {
				logger?.warning(`Skipping invalid item ${itemToAdd.id}, asset ${itemToAdd.asset.id}`);
			} else {
				newItems = tryItem;
			}
		}

		while (currentBodypartIndex !== null) {
			const bodypart = this.assetMananger.bodyparts[currentBodypartIndex];

			// Check if we need to add required bodypart
			if (bodypart.required && !newItems.some((item) => item.asset.definition.bodypart === bodypart.name)) {
				// Find matching bodypart assets
				const possibleAssets = this.assetMananger
					.getAllAssets()
					.filter((asset) => asset.definition.bodypart === bodypart.name);

				ShuffleArray(possibleAssets);

				for (const asset of possibleAssets) {
					const tryFix = [...newItems, this.makeItem(`i/requiredbodypart/${bodypart.name}` as const, asset)];
					if (ValidateAppearanceItemsPrefix(this.assetMananger, tryFix)) {
						newItems = tryFix;
						break;
					}
				}
			}

			if (bodypart.required && !newItems.some((item) => item.asset.definition.bodypart === bodypart.name)) {
				throw new Error(`Failed to satisfy the requirement for '${bodypart.name}'`);
			}

			// Move to next bodypart or end validation if all are done
			currentBodypartIndex++;
			if (currentBodypartIndex >= this.assetMananger.bodyparts.length) {
				currentBodypartIndex = null;
			}
		}

		if (!ValidateAppearanceItems(this.assetMananger, newItems)) {
			throw new Error('Invalid appearance after load');
		}

		this.items = newItems;
		this.pose.clear();
		for (const bone of this.assetMananger.getAllBones()) {
			this.pose.set(bone.name, {
				definition: bone,
				rotation: Number.isInteger(bundle.pose[bone.name]) ? bundle.pose[bone.name] : 0,
			});
		}
		this._armsPose = bundle.handsPose;
		this._view = bundle.view;
		this.fullPose = Array.from(this.pose.values());
		if (logger) {
			for (const k of Object.keys(bundle.pose)) {
				if (!this.pose.has(k)) {
					logger.warning(`Skipping unknown pose bone ${k}`);
				}
			}
		}
		this.onChange(['items', 'pose']);
	}

	public importPose(pose: Record<BoneName, number>, type: BoneType | true, missingAsZero: boolean): void {
		for (const [bone, state] of this.pose.entries()) {
			if (type !== true && state.definition.type !== type)
				continue;
			if (!missingAsZero && pose[state.definition.name] == null)
				continue;
			this.pose.set(bone, {
				definition: state.definition,
				rotation: pose[state.definition.name] || 0,
			});
		}
		this.fullPose = Array.from(this.pose.values());
		this.onChange(['pose']);
	}

	public exportPose(type?: BoneType): Record<BoneName, number> {
		const pose: Record<BoneName, number> = {};
		for (const state of this.pose.values()) {
			if (state.rotation === 0) {
				continue;
			}
			if (type && state.definition.type !== type) {
				continue;
			}
			pose[state.definition.name] = state.rotation;
		}
		return pose;
	}

	public reloadAssetManager(assetManager: AssetManager, logger?: Logger) {
		if (this.assetMananger === assetManager)
			return;
		const bundle = this.exportToBundle();
		this.assetMananger = assetManager;
		this.importFromBundle(bundle, logger);
	}

	protected onChange(changes: AppearanceChangeType[]): void {
		this.onChangeHandler?.(changes);
	}

	public getItemById(id: ItemId): Item | undefined {
		return this.items.find((i) => i.id === id);
	}

	public listItemsByAsset(asset: AssetId) {
		return this.items.filter((i) => i.asset.id === asset);
	}

	public getAllItems(): readonly Item[] {
		return this.items;
	}

	public allowCreateItem(id: ItemId, asset: Asset): boolean {
		// Race condition prevention
		if (this.getItemById(id))
			return false;

		// Simulate change
		const item = this.makeItem(id, asset);
		let newItems = this.items;
		// if this is a bodypart not allowing multiple do a swap instead
		if (item.asset.definition.bodypart && this.assetMananger.bodyparts.find((bp) => bp.name === item.asset.definition.bodypart)?.allowMultiple === false) {
			newItems = newItems.filter((oldItem) => oldItem.asset === asset || oldItem.asset.definition.bodypart !== item.asset.definition.bodypart);
		}
		newItems = AppearanceItemsFixBodypartOrder(this.assetMananger, [...newItems, item]);

		return ValidateAppearanceItems(this.assetMananger, newItems);
	}

	public createItem(id: ItemId, asset: Asset): Item {
		if (!this.allowCreateItem(id, asset)) {
			throw new Error('Attempt to create item while not allowed');
		}

		// Do change
		const item = this.makeItem(id, asset);
		let newItems = this.items;
		// if this is a bodypart not allowing multiple do a swap instead
		if (item.asset.definition.bodypart && this.assetMananger.bodyparts.find((bp) => bp.name === item.asset.definition.bodypart)?.allowMultiple === false) {
			newItems = newItems.filter((oldItem) => oldItem.asset === asset || oldItem.asset.definition.bodypart !== item.asset.definition.bodypart);
		}
		newItems = AppearanceItemsFixBodypartOrder(this.assetMananger, [...newItems, item]);

		this.items = newItems;
		this.onChange(['items']);

		return item;
	}

	public allowRemoveItem(id: ItemId): boolean {
		const item = this.getItemById(id);
		if (!item)
			return false;

		// Simulate change
		const newItems = this.items.filter((i) => i.id !== id);

		return ValidateAppearanceItems(this.assetMananger, newItems);
	}

	public removeItem(id: ItemId): void {
		if (!this.allowRemoveItem(id)) {
			throw new Error('Attempt to remove item while not allowed');
		}

		// Do change
		const newItems = this.items.filter((i) => i.id !== id);

		this.items = newItems;
		this.onChange(['items']);
	}

	public allowMoveItem(id: ItemId, shift: number): boolean {
		const currentPos = this.items.findIndex((item) => item.id === id);
		const newPos = currentPos + shift;

		if (currentPos < 0 || newPos < 0 || newPos >= this.items.length)
			return false;

		// Simulate change
		const newItems = this.items.slice();
		const moved = newItems.splice(currentPos, 1);
		newItems.splice(newPos, 0, ...moved);

		return ValidateAppearanceItems(this.assetMananger, newItems);
	}

	public moveItem(id: ItemId, shift: number): void {
		if (!this.allowMoveItem(id, shift)) {
			throw new Error('Attempt to move item while not allowed');
		}

		const currentPos = this.items.findIndex((item) => item.id === id);
		const newPos = currentPos + shift;

		if (currentPos < 0 || newPos < 0 || newPos >= this.items.length)
			throw new Error('Valid move outside of range');

		// Do change
		const newItems = this.items.slice();
		const moved = newItems.splice(currentPos, 1);
		newItems.splice(newPos, 0, ...moved);

		this.items = newItems;
		this.onChange(['items']);
	}

	public setPose(bone: string, value: number): void {
		if (!Number.isInteger(value))
			throw new Error('Attempt to set non-int pose value');
		const state = this.pose.get(bone);
		if (!state)
			throw new Error(`Attempt to set pose for unknown bone: ${bone}`);
		if (state.rotation !== value) {
			this.pose.set(bone, {
				definition: state.definition,
				rotation: value,
			});
			this.fullPose = Array.from(this.pose.values());
			this.onChange(['pose']);
		}
	}

	public getPose(bone: string): BoneState {
		const state = this.pose.get(bone);
		if (!state)
			throw new Error(`Attempt to get pose for unknown bone: ${bone}`);
		return { ...state };
	}

	public getFullPose(): readonly BoneState[] {
		return this.fullPose;
	}

	public getArmsPose(): ArmsPose {
		return this._armsPose;
	}

	public setArmsPose(value: ArmsPose): void {
		if (this._armsPose !== value) {
			this._armsPose = value;
			this.onChange(['pose']);
		}
	}

	public getView(): CharacterView {
		return this._view;
	}

	public setView(value: CharacterView): void {
		if (this._view !== value) {
			this._view = value;
			this.onChange(['pose']);
		}
	}
}
