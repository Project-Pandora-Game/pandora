import _, { cloneDeep, isEqual } from 'lodash';
import { z } from 'zod';
import type { ICharacterMinimalData } from '../character';
import { CharacterRestrictionsManager } from '../character/restrictionsManager';
import type { ActionRoomContext } from '../chatroom';
import { Logger } from '../logging';
import { AppearanceRootManipulator } from './appearanceHelpers';
import type { ActionProcessingContext, ItemPath, RoomActionTargetCharacter } from './appearanceTypes';
import { AppearanceItemProperties, AppearanceItems, AppearanceLoadAndValidate, AppearanceValidationResult, ValidateAppearanceItems } from './appearanceValidation';
import { AssetManager } from './assetManager';
import { AssetId, PartialAppearancePose } from './definitions';
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

export const SafemodeDataSchema = z.object({
	allowLeaveAt: z.number(),
});
export type SafemodeData = z.infer<typeof SafemodeDataSchema>;

/** Time after entering safemode for which you cannot leave it (entering while in dev mode ignores this) */
export const SAFEMODE_EXIT_COOLDOWN = 60 * 60_000;

export const AppearanceArmPoseSchema = z.object({
	position: z.nativeEnum(ArmsPose),
});
export type AppearanceArmPose = z.infer<typeof AppearanceArmPoseSchema>;

export const AppearancePoseSchema = z.object({
	bones: z.record(BoneNameSchema, z.number().optional()),
	leftArm: AppearanceArmPoseSchema,
	rightArm: AppearanceArmPoseSchema,
	view: z.nativeEnum(CharacterView),
});
export type AppearancePose = z.infer<typeof AppearancePoseSchema>;

export const AppearanceBundleSchema = AppearancePoseSchema.extend({
	items: z.array(ItemBundleSchema),
	safemode: SafemodeDataSchema.optional(),
});

export type AppearanceBundle = z.infer<typeof AppearanceBundleSchema>;

export function GetDefaultAppearanceBundle(): AppearanceBundle {
	return {
		items: [],
		bones: {},
		leftArm: {
			position: ArmsPose.FRONT,
		},
		rightArm: {
			position: ArmsPose.FRONT,
		},
		view: CharacterView.FRONT,
	};
}

export type AppearanceChangeType = 'items' | 'pose' | 'safemode';

export type CharacterArmsPose = Readonly<Pick<AppearancePose, 'leftArm' | 'rightArm'>>;

export class CharacterAppearance implements RoomActionTargetCharacter {
	public readonly type = 'character';
	private readonly getCharacter: () => Readonly<ICharacterMinimalData>;

	protected assetManager: AssetManager;
	public onChangeHandler: ((changes: AppearanceChangeType[]) => void) | undefined;

	private items: AppearanceItems = [];
	private readonly pose = new Map<BoneName, BoneState>();
	private fullPose: readonly BoneState[] = [];
	private _arms: CharacterArmsPose;
	private _view: CharacterView;
	private _safemode: SafemodeData | undefined;

	public get character(): Readonly<ICharacterMinimalData> {
		return this.getCharacter();
	}

	constructor(assetManager: AssetManager, getCharacter: () => Readonly<ICharacterMinimalData>, onChange?: (changes: AppearanceChangeType[]) => void) {
		const { leftArm, rightArm, view } = GetDefaultAppearanceBundle();
		this._arms = { leftArm, rightArm };
		this._view = view;
		this.assetManager = assetManager;
		this.getCharacter = getCharacter;
		this.importFromBundle(GetDefaultAppearanceBundle());
		this.onChangeHandler = onChange;
	}

	public getRestrictionManager(room: ActionRoomContext | null): CharacterRestrictionsManager {
		return new CharacterRestrictionsManager(this, room);
	}

	public exportToBundle(): AppearanceBundle {
		return {
			items: this.items.map((item) => item.exportToBundle()),
			bones: this.exportBones(),
			leftArm: _.cloneDeep(this._arms.leftArm),
			rightArm: _.cloneDeep(this._arms.rightArm),
			view: this._view,
			safemode: this._safemode,
		};
	}

	public importFromBundle(bundle: AppearanceBundle | undefined, logger?: Logger, assetManager?: AssetManager): void {
		// Simple migration
		bundle = {
			...GetDefaultAppearanceBundle(),
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
		const newItems = AppearanceLoadAndValidate(this.assetManager, loadedItems, logger);

		if (!ValidateAppearanceItems(this.assetManager, newItems).success) {
			throw new Error('Invalid appearance after load');
		}

		this.items = newItems;
		this.pose.clear();
		for (const bone of this.assetManager.getAllBones()) {
			this.pose.set(bone.name, {
				definition: bone,
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
				rotation: Number.isInteger(bundle.bones[bone.name]) ? _.clamp(bundle.bones[bone.name]!, BONE_MIN, BONE_MAX) : 0,
			});
		}
		this._arms = {
			leftArm: _.cloneDeep(bundle.leftArm),
			rightArm: _.cloneDeep(bundle.rightArm),
		};
		this._view = bundle.view;
		this.fullPose = Array.from(this.pose.values());
		if (logger) {
			for (const k of Object.keys(bundle.bones)) {
				if (!this.pose.has(k)) {
					logger.warning(`Skipping unknown pose bone ${k}`);
				}
			}
		}
		this.enforcePoseLimits();

		// Import safemode status
		this._safemode = bundle.safemode;

		this.onChange(['items', 'pose', 'safemode']);
	}

	protected enforcePoseLimits(): boolean {
		const limits = AppearanceItemProperties(this.items).limits;
		if (!limits || limits.isEmpty())
			return false;

		const { changed, pose } = limits.force({
			bones: Object.fromEntries([...this.pose.entries()].map(([bone, state]) => [bone, state.rotation])),
			leftArm: this._arms.leftArm,
			rightArm: this._arms.rightArm,
			view: this._view,
		});
		if (!changed)
			return false;

		const { bones, leftArm, rightArm, view } = pose;

		this._view = view;
		this._arms = {
			leftArm,
			rightArm,
		};
		for (const [bone, state] of this.pose.entries()) {
			const rotation = bones[bone];
			if (rotation != null && rotation !== state.rotation) {
				this.pose.set(bone, {
					definition: state.definition,
					rotation,
				});
			}
		}

		this.fullPose = Array.from(this.pose.values());

		return true;
	}

	public importPose(pose: PartialAppearancePose, type: BoneType | true, missingAsZero: boolean): void {
		const [changed, arms] = this._newArmsPose(pose);
		const { bones } = pose;
		if (!bones) {
			if (changed) {
				this._arms = arms;
				this.enforcePoseLimits();
				this.onChange(['pose']);
			}
			return;
		} else if (changed) {
			this._arms = arms;
		}
		for (const [bone, state] of this.pose.entries()) {
			if (type !== true && state.definition.type !== type)
				continue;
			if (!missingAsZero && bones[state.definition.name] == null)
				continue;

			this.pose.set(bone, {
				definition: state.definition,
				rotation: _.clamp(bones[state.definition.name] || 0, BONE_MIN, BONE_MAX),
			});
		}
		this.fullPose = Array.from(this.pose.values());
		this.enforcePoseLimits();
		this.onChange(['pose']);
	}

	public exportBones(type?: BoneType): Record<BoneName, number> {
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
		if (this.assetManager === assetManager && !force)
			return;
		const bundle = this.exportToBundle();
		this.assetManager = assetManager;
		this.importFromBundle(bundle, logger);
	}

	public getAssetManager(): AssetManager {
		return this.assetManager;
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
		return new AppearanceRootManipulator(this.assetManager, this.items, true);
	}

	public commitChanges(manipulator: AppearanceRootManipulator, context: ActionProcessingContext): AppearanceValidationResult {
		const newItems = manipulator.getRootItems();

		// Validate
		const r = ValidateAppearanceItems(this.assetManager, newItems);
		if (!r.success)
			return r;

		if (context.dryRun)
			return { success: true };

		this.items = newItems;
		const poseChanged = this.enforcePoseLimits();
		this.onChange(poseChanged ? ['items', 'pose'] : ['items']);

		for (const message of manipulator.getAndClearPendingMessages()) {
			context.actionHandler?.({
				...message,
				character: context.sourceCharacter ? {
					type: 'character',
					id: context.sourceCharacter,
				} : undefined,
				target: {
					type: 'character',
					id: this.character.id,
				},
			});
		}

		return { success: true };
	}

	public setPose(bone: string, value: number): void {
		if (!Number.isInteger(value))
			throw new Error('Attempt to set non-int pose value');
		const state = this.pose.get(bone);
		if (!state)
			throw new Error(`Attempt to set pose for unknown bone: ${bone}`);

		this.importPose({ bones: { [bone]: value } }, true, false);
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

	public getArmsPose(): CharacterArmsPose {
		return this._arms;
	}

	public setArmsPose(pose: Pick<PartialAppearancePose, 'arms' | 'leftArm' | 'rightArm'>): void {
		const [changed, arms] = this._newArmsPose(pose);
		if (changed) {
			this._arms = arms;
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

	public getSafemode(): Readonly<SafemodeData> | null {
		return this._safemode ?? null;
	}

	public setSafemode(value: Readonly<SafemodeData> | null, context: ActionProcessingContext): void {
		if (context.dryRun)
			return;

		const stateChange = (this._safemode != null) !== (value != null);
		if (!isEqual(this._safemode ?? null, value)) {
			this._safemode = cloneDeep(value) ?? undefined;
			this.onChange(['safemode']);

			if (stateChange) {
				context.actionHandler?.({
					id: value != null ? 'safemodeEnter' : 'safemodeLeave',
					character: {
						type: 'character',
						id: this.character.id,
					},
				});
			}
		}
	}

	private _newArmsPose({ arms, leftArm: left, rightArm: right }: Pick<PartialAppearancePose, 'arms' | 'leftArm' | 'rightArm'>): [boolean, CharacterArmsPose] {
		const leftArm = { ...this._arms.leftArm, ...arms, ...left };
		const rightArm = { ...this._arms.rightArm, ...arms, ...right };
		const changed = this._arms.leftArm.position !== leftArm.position
			|| this._arms.rightArm.position !== rightArm.position;

		return [changed, { leftArm, rightArm }];
	}
}
