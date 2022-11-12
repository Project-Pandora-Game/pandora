import _ from 'lodash';
import { z } from 'zod';
import type { CharacterId } from '../character';
import type { ChatActionId, IChatRoomMessageActionItem } from '../chatroom';
import { Logger } from '../logging';
import { ShuffleArray } from '../utility';
import { HexColorString } from '../validation';
import { AppearanceRootManipulator } from './appearanceHelpers';
import { AppearanceItems, AppearanceItemsFixBodypartOrder, AppearanceItemsGetPoseLimits, ValidateAppearanceItems, ValidateAppearanceItemsPrefix } from './appearanceValidation';
import { Asset } from './asset';
import { AssetManager } from './assetManager';
import { AssetId } from './definitions';
import { BoneState, BoneType } from './graphics';
import { Item, ItemBundle, ItemBundleSchema, ItemId } from './item';
import { ItemModuleAction } from './modules';

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

export type AppearanceActionHandlerMessage = {
	id: ChatActionId;
	character?: CharacterId;
	targetCharacter?: CharacterId;
	item?: IChatRoomMessageActionItem;
	itemPrevious?: IChatRoomMessageActionItem;
	dictionary?: Record<string, string>;
};
export type AppearanceActionHandler = (message: AppearanceActionHandlerMessage) => void;

export interface AppearanceActionProcessingContext {
	player?: CharacterId;
	sourceCharacter?: CharacterId;
	actionHandler?: AppearanceActionHandler;
	dryRun?: boolean;
}

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

	protected makeItem(id: ItemId, asset: Asset, bundle: ItemBundle | null, logger?: Logger): Item {
		return new Item(id, asset, bundle ?? {
			id,
			asset: asset.id,
		}, {
			assetMananger: this.assetMananger,
			doLoadTimeCleanup: bundle !== null,
			logger,
		});
	}

	public spawnItem(id: ItemId, asset: Asset): Item {
		return this.makeItem(id, asset, null);
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

			const item = this.makeItem(itemBundle.id, asset, itemBundle, logger);
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
						const tryFix = [...newItems, this.makeItem(`i/requiredbodypart/${bodypart.name}` as const, asset, null, logger)];
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
					const tryFix = [...newItems, this.makeItem(`i/requiredbodypart/${bodypart.name}` as const, asset, null, logger)];
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

	public getItemById(id: ItemId): Item | undefined {
		return this.items.find((i) => i.id === id);
	}

	public listItemsByAsset(asset: AssetId) {
		return this.items.filter((i) => i.asset.id === asset);
	}

	public getAllItems(): readonly Item[] {
		return this.items;
	}

	protected _getManipulator(): AppearanceRootManipulator {
		return new AppearanceRootManipulator(this.assetMananger, this.items);
	}

	public addItem(item: Item, ctx: AppearanceActionProcessingContext): boolean {
		// Id must be unique
		if (this.getItemById(item.id))
			return false;

		const manipulator = this._getManipulator();

		// Do change
		let removed: AppearanceItems = [];
		// if this is a bodypart not allowing multiple do a swap instead
		if (item.asset.definition.bodypart && this.assetMananger.bodyparts.find((bp) => bp.name === item.asset.definition.bodypart)?.allowMultiple === false) {
			removed = manipulator.removeMatchingItems((oldItem) => oldItem.asset.definition.bodypart === item.asset.definition.bodypart);
		}
		if (!manipulator.addItem(item))
			return false;

		const newItems = manipulator.getItems();

		// Validate
		if (!ValidateAppearanceItems(this.assetMananger, newItems))
			return false;

		if (ctx.dryRun)
			return true;

		this.items = newItems;
		const poseChanged = this.enforcePoseLimits();
		this.onChange(poseChanged ? ['items', 'pose'] : ['items']);

		// Change message to chat
		if (ctx.actionHandler) {
			if (removed.length > 0) {
				ctx.actionHandler({
					id: 'itemReplace',
					character: ctx.sourceCharacter,
					targetCharacter: ctx.player,
					item: {
						assetId: item.asset.id,
					},
					itemPrevious: {
						assetId: removed[0].asset.id,
					},
				});
			} else {
				ctx.actionHandler({
					id: 'itemAdd',
					character: ctx.sourceCharacter,
					targetCharacter: ctx.player,
					item: {
						assetId: item.asset.id,
					},
				});
			}
		}

		return true;
	}

	public removeItem(itemId: ItemId, ctx: AppearanceActionProcessingContext): boolean {
		const manipulator = this._getManipulator();

		// Do change
		const removedItems = manipulator.removeMatchingItems((i) => i.id === itemId);
		const newItems = manipulator.getItems();

		// Validate
		if (removedItems.length !== 1)
			return false;
		if (!ValidateAppearanceItems(this.assetMananger, newItems))
			return false;

		if (ctx.dryRun)
			return true;

		this.items = newItems;
		const poseChanged = this.enforcePoseLimits();
		this.onChange(poseChanged ? ['items', 'pose'] : ['items']);

		// Change message to chat
		if (ctx.actionHandler && removedItems.length > 0) {
			ctx.actionHandler({
				id: 'itemRemove',
				character: ctx.sourceCharacter,
				targetCharacter: ctx.player,
				item: {
					assetId: removedItems[0].asset.id,
				},
			});
		}

		return true;
	}

	public moveItem(itemId: ItemId, shift: number, ctx: AppearanceActionProcessingContext): boolean {
		const manipulator = this._getManipulator();

		// Do change
		if (!manipulator.moveItem(itemId, shift))
			return false;

		const newItems = manipulator.getItems();

		// Validate
		if (!ValidateAppearanceItems(this.assetMananger, newItems))
			return false;

		if (ctx.dryRun)
			return true;

		this.items = newItems;
		const poseChanged = this.enforcePoseLimits();
		this.onChange(poseChanged ? ['items', 'pose'] : ['items']);

		// Change message to chat
		if (ctx.actionHandler) {
			// TODO: Message to chat that items were reordered
		}

		return true;
	}

	public colorItem(itemId: ItemId, color: readonly HexColorString[], ctx: AppearanceActionProcessingContext): boolean {
		const manipulator = this._getManipulator();

		// Do change
		manipulator.modifyItem(itemId, (it) => it.changeColor(color));
		const newItems = manipulator.getItems();

		// Validate
		if (!ValidateAppearanceItems(this.assetMananger, newItems))
			return false;

		if (ctx.dryRun)
			return true;

		this.items = newItems;
		const poseChanged = this.enforcePoseLimits();
		this.onChange(poseChanged ? ['items', 'pose'] : ['items']);

		// Change message to chat
		if (ctx.actionHandler) {
			// TODO: Message to chat that item was colored
		}

		return true;
	}

	public moduleAction(itemId: ItemId, module: string, action: ItemModuleAction, ctx: AppearanceActionProcessingContext): boolean {
		const manipulator = this._getManipulator();

		// Do change
		manipulator.modifyItem(itemId, (it) => it.moduleAction(module, action));
		const newItems = manipulator.getItems();

		// Validate
		if (!ValidateAppearanceItems(this.assetMananger, newItems))
			return false;

		if (ctx.dryRun)
			return true;

		this.items = newItems;
		const poseChanged = this.enforcePoseLimits();
		this.onChange(poseChanged ? ['items', 'pose'] : ['items']);

		// Change message to chat
		if (ctx.actionHandler) {
			// TODO: Message to chat that item module was changed
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
