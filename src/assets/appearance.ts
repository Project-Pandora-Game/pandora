import { Logger } from '../logging';
import { Asset } from './asset';
import { AssetManager } from './assetManager';
import { AssetId } from './definitions';
import { BoneState } from './graphics';
import { Item, ItemBundle, ItemId } from './item';

export type BoneName = string;

export enum ArmsPose {
	FRONT,
	BACK,
}

export interface AppearanceBundle {
	items: ItemBundle[];
	pose: Record<BoneName, number>;
	handsPose: ArmsPose;
}

export const APPEARANCE_BUNDLE_DEFAULT: AppearanceBundle = {
	items: [],
	pose: {},
	handsPose: ArmsPose.FRONT,
};

export type AppearanceChangeType = 'items' | 'pose';

export class Appearance {
	private assetMananger: AssetManager;
	public onChangeHandler: ((changes: AppearanceChangeType[]) => void) | undefined;

	// This array is readonly so it can be used directly by React hooks
	private items: readonly Item[] = [];
	private readonly pose = new Map<BoneName, BoneState>();
	private fullPose: readonly BoneState[] = [];
	private _armsPose: ArmsPose = APPEARANCE_BUNDLE_DEFAULT.handsPose;

	constructor(assetMananger: AssetManager, onChange?: (changes: AppearanceChangeType[]) => void) {
		this.assetMananger = assetMananger;
		this.importFromBundle(APPEARANCE_BUNDLE_DEFAULT);
		this.onChangeHandler = onChange;
	}

	protected makeItem(id: ItemId, asset: Asset): Item {
		return new Item(id, asset);
	}

	public exportToBundle(): AppearanceBundle {
		const pose: Record<BoneName, number> = {};
		for (const state of this.pose.values()) {
			if (state.rotation !== 0) {
				pose[state.definition.name] = state.rotation;
			}
		}
		return {
			items: this.items.map((item) => item.exportToBundle()),
			pose,
			handsPose: this._armsPose,
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
		const newItems: Item[] = [];
		for (const itemBundle of bundle.items) {
			const asset = this.assetMananger.getAssetById(itemBundle.asset);
			if (asset === undefined) {
				logger?.warning(`Skipping unknown asset ${itemBundle.asset}`);
				continue;
			}

			const item = this.makeItem(itemBundle.id, asset);
			newItems.push(item);
			item.importFromBundle(itemBundle);
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
		// Each item can only be added once
		if (this.listItemsByAsset(asset.id).length > 0)
			return false;
		return true;
	}

	public createItem(id: ItemId, asset: Asset): Item {
		if (!this.allowCreateItem(id, asset)) {
			throw new Error('Attempt to create item while not allowed');
		}
		const item = this.makeItem(id, asset);
		this.items = [...this.items, item];
		this.onChange(['items']);
		return item;
	}

	public allowRemoveItem(id: ItemId): boolean {
		const item = this.getItemById(id);
		if (!item)
			return false;
		return true;
	}

	public removeItem(id: ItemId): void {
		if (!this.allowRemoveItem(id)) {
			throw new Error('Attempt to remove item while not allowed');
		}
		this.items = this.items.filter((i) => i.id !== id);
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
}
