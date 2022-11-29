import _ from 'lodash';
import { z } from 'zod';
import type { CharacterId } from '../character';
import { Logger } from '../logging';
import { ShuffleArray } from '../utility';
import { AppearanceRootManipulator } from './appearanceHelpers';
import type { AppearanceActionProcessingContext, ItemPath, RoomActionTargetCharacter } from './appearanceTypes';
import { AppearanceItems, AppearanceItemsFixBodypartOrder, AppearanceItemsGetPoseLimits, AppearanceValidationResult, ValidateAppearanceItems, ValidateAppearanceItemsPrefix } from './appearanceValidation';
import { AssetManager } from './assetManager';
import { AssetId } from './definitions';
import { BoneState, BoneType } from './graphics';
import { Item, ItemBundleSchema } from './item';

export const BoneNameSchema = z.string();
export type BoneName = z.infer<typeof BoneNameSchema>;

export const BONE_MIN = -180;
export const BONE_MAX = 180;

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

export class CharacterAppearance implements RoomActionTargetCharacter {
	public readonly type = 'character';
	public readonly characterId: CharacterId;

	protected assetMananger: AssetManager;
	public onChangeHandler: ((changes: AppearanceChangeType[]) => void) | undefined;

	private items: AppearanceItems = [];
	private readonly pose = new Map<BoneName, BoneState>();
	private fullPose: readonly BoneState[] = [];
	private _armsPose: ArmsPose = APPEARANCE_BUNDLE_DEFAULT.handsPose;
	private _view: CharacterView = APPEARANCE_BUNDLE_DEFAULT.view;

	constructor(assetMananger: AssetManager, characterId: CharacterId, onChange?: (changes: AppearanceChangeType[]) => void) {
		this.assetMananger = assetMananger;
		this.characterId = characterId;
		this.importFromBundle(APPEARANCE_BUNDLE_DEFAULT);
		this.onChangeHandler = onChange;
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

			const item = this.assetMananger.createItem(itemBundle.id, asset, itemBundle, logger);
			loadedItems.push(item);
		}

		// Validate and add all items
		loadedItems = AppearanceItemsFixBodypartOrder(this.assetMananger, loadedItems);
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
						const tryFix = [...newItems, this.assetMananger.createItem(`i/requiredbodypart/${bodypart.name}` as const, asset, null, logger)];
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
					const tryFix = [...newItems, this.assetMananger.createItem(`i/requiredbodypart/${bodypart.name}` as const, asset, null, logger)];
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
				rotation: Number.isInteger(bundle.pose[bone.name]) ? _.clamp(bundle.pose[bone.name], BONE_MIN, BONE_MAX) : 0,
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
		this.enforcePoseLimits();
		this.onChange(['items', 'pose']);
	}

	protected enforcePoseLimits(): boolean {
		const poseLimits = AppearanceItemsGetPoseLimits(this.items);
		if (poseLimits == null)
			return false;
		let change = false;

		if (poseLimits.forceArms != null && this._armsPose !== poseLimits.forceArms) {
			this._armsPose = poseLimits.forceArms;
			change = true;
		}

		for (const [bone, state] of this.pose.entries()) {
			const limits = poseLimits.forcePose.get(bone);
			if (limits == null)
				continue;

			const rotation = _.clamp(state.rotation, limits[0], limits[1]);
			if (rotation === state.rotation)
				continue;

			this.pose.set(bone, {
				definition: state.definition,
				rotation,
			});
			change = true;
		}

		if (change) {
			this.fullPose = Array.from(this.pose.values());
		}

		return change;
	}

	public importPose(pose: Partial<Record<BoneName, number>>, type: BoneType | true, missingAsZero: boolean): void {
		for (const [bone, state] of this.pose.entries()) {
			if (type !== true && state.definition.type !== type)
				continue;
			if (!missingAsZero && pose[state.definition.name] == null)
				continue;

			this.pose.set(bone, {
				definition: state.definition,
				rotation: _.clamp(pose[state.definition.name] || 0, BONE_MIN, BONE_MAX),
			});
		}
		this.fullPose = Array.from(this.pose.values());
		this.enforcePoseLimits();
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

	public reloadAssetManager(assetManager: AssetManager, logger?: Logger, force: boolean = false) {
		if (this.assetMananger === assetManager && !force)
			return;
		const bundle = this.exportToBundle();
		this.assetMananger = assetManager;
		this.importFromBundle(bundle, logger);
	}

	protected onChange(changes: AppearanceChangeType[]): void {
		this.onChangeHandler?.(changes);
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

	public listItemsByAsset(asset: AssetId) {
		return this.items.filter((i) => i.asset.id === asset);
	}

	public getAllItems(): readonly Item[] {
		return this.items;
	}

	public getManipulator(): AppearanceRootManipulator {
		return new AppearanceRootManipulator(this.assetMananger, this.items, true);
	}

	public commitChanges(manipulator: AppearanceRootManipulator, context: AppearanceActionProcessingContext): AppearanceValidationResult {
		const newItems = manipulator.getRootItems();

		// Validate
		if (!ValidateAppearanceItems(this.assetMananger, newItems))
			return false;

		if (context.dryRun)
			return true;

		this.items = newItems;
		const poseChanged = this.enforcePoseLimits();
		this.onChange(poseChanged ? ['items', 'pose'] : ['items']);

		for (const message of manipulator.getAndClearPendingMessages()) {
			context.actionHandler?.({
				...message,
				character: context.sourceCharacter,
				targetCharacter: this.characterId,
			});
		}

		return true;
	}

	public setPose(bone: string, value: number): void {
		if (!Number.isInteger(value))
			throw new Error('Attempt to set non-int pose value');
		const state = this.pose.get(bone);
		if (!state)
			throw new Error(`Attempt to set pose for unknown bone: ${bone}`);

		this.importPose({ [bone]: value }, true, false);
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
			this.enforcePoseLimits();
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
