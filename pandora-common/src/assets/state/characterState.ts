import { AppearanceItemProperties, AppearanceItems, AppearanceValidationResult, CharacterAppearanceLoadAndValidate, ValidateAppearanceItems } from '../appearanceValidation';
import { PartialAppearancePose, WearableAssetType } from '../definitions';
import { Assert, MemoizeNoArg } from '../../utility';
import { ZodArrayWithInvalidDrop } from '../../validation';
import { freeze } from 'immer';
import { z } from 'zod';
import { ArmFingersSchema, ArmPoseSchema, ArmRotationSchema, BoneName, BoneNameSchema, BoneState, BoneType } from '../graphics';
import { Item, ItemBundleSchema } from '../item';
import { AssetManager } from '../assetManager';
import { BONE_MAX, BONE_MIN, CharacterArmsPose, GetDefaultAppearanceBundle } from '../appearance';
import { Logger } from '../../logging';
import _, { isEqual } from 'lodash';
import { AssetFrameworkRoomState } from './roomState';
import { CharacterId } from '../../character';
import type { IExportOptions } from '../modules/common';

export const CharacterViewSchema = z.enum(['front', 'back']);
export type CharacterView = z.infer<typeof CharacterViewSchema>;

export const SafemodeDataSchema = z.object({
	allowLeaveAt: z.number(),
});
export type SafemodeData = z.infer<typeof SafemodeDataSchema>;

export const AppearanceArmPoseSchema = z.object({
	position: ArmPoseSchema.catch('front'),
	rotation: ArmRotationSchema.catch('forward'),
	fingers: ArmFingersSchema.catch('spread'),
});
export type AppearanceArmPose = z.infer<typeof AppearanceArmPoseSchema>;

export const AppearancePoseSchema = z.object({
	bones: z.record(BoneNameSchema, z.number().optional()).default({}),
	leftArm: AppearanceArmPoseSchema.default({}),
	rightArm: AppearanceArmPoseSchema.default({}),
	view: CharacterViewSchema.catch('front'),
});
export type AppearancePose = z.infer<typeof AppearancePoseSchema>;

export const AppearanceBundleSchema = AppearancePoseSchema.extend({
	items: ZodArrayWithInvalidDrop(ItemBundleSchema, z.record(z.unknown())),
	safemode: SafemodeDataSchema.optional(),
	clientOnly: z.boolean().optional(),
});
export type AppearanceBundle = z.infer<typeof AppearanceBundleSchema>;
export type AppearanceClientBundle = AppearanceBundle & { clientOnly: true; };

export type AppearanceCharacterPose = ReadonlyMap<BoneName, BoneState>;

/**
 * State of an character. Immutable.
 */
export class AssetFrameworkCharacterState {
	public readonly type = 'character';
	public readonly assetManager: AssetManager;

	public readonly id: CharacterId;
	public readonly items: AppearanceItems<WearableAssetType>;
	public readonly pose: AppearanceCharacterPose;
	public readonly arms: CharacterArmsPose;
	public readonly view: CharacterView;
	public readonly safemode: SafemodeData | undefined;

	private constructor(
		assetManager: AssetManager,
		id: CharacterId,
		items: AppearanceItems<WearableAssetType>,
		pose: AppearanceCharacterPose,
		arms: CharacterArmsPose,
		view: CharacterView,
		safemode: SafemodeData | undefined,
	) {
		this.assetManager = assetManager;
		this.id = id;
		this.items = items;
		this.pose = pose;
		this.arms = arms;
		this.view = view;
		this.safemode = safemode;
	}

	public isValid(): boolean {
		return this.validate().success;
	}

	@MemoizeNoArg
	public validate(): AppearanceValidationResult {
		{
			const r = ValidateAppearanceItems(this.assetManager, this.items);
			if (!r.success)
				return r;
		}

		if (!this.validatePoseLimits()) {
			return {
				success: false,
				error: {
					problem: 'invalidPose',
				},
			};
		}

		return {
			success: true,
		};
	}

	public exportVolatileFullPose(): AppearancePose {
		return {
			bones: Object.fromEntries([...this.pose.entries()].map(([bone, state]) => [bone, state.rotation])),
			leftArm: this.arms.leftArm,
			rightArm: this.arms.rightArm,
			view: this.view,
		};
	}

	public exportToBundle(options: IExportOptions = {}): AppearanceBundle {
		return {
			items: this.items.map((item) => item.exportToBundle(options)),
			bones: this.exportBones(),
			leftArm: _.cloneDeep(this.arms.leftArm),
			rightArm: _.cloneDeep(this.arms.rightArm),
			view: this.view,
			safemode: this.safemode,
		};
	}

	public exportToClientBundle(options: IExportOptions = {}): AppearanceClientBundle {
		options.clientOnly = true;
		return {
			items: this.items.map((item) => item.exportToBundle(options)),
			bones: this.exportBones(),
			leftArm: _.cloneDeep(this.arms.leftArm),
			rightArm: _.cloneDeep(this.arms.rightArm),
			view: this.view,
			safemode: this.safemode,
			clientOnly: true,
		};
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

	public validatePoseLimits(): boolean {
		const limits = AppearanceItemProperties(this.items).limits;
		if (!limits || limits.hasNoLimits())
			return true;

		return limits.validate(this.exportVolatileFullPose());
	}

	public enforcePoseLimits(): AssetFrameworkCharacterState {
		const limits = AppearanceItemProperties(this.items).limits;
		if (!limits || limits.hasNoLimits())
			return this;

		const { changed, pose } = limits.force(this.exportVolatileFullPose());
		if (!changed)
			return this;

		const { bones, leftArm, rightArm, view } = pose;

		const newPose = new Map(this.pose);
		for (const [bone, state] of newPose.entries()) {
			const rotation = bones[bone];
			if (rotation != null && rotation !== state.rotation) {
				newPose.set(bone, {
					definition: state.definition,
					rotation,
				});
			}
		}

		return new AssetFrameworkCharacterState(
			this.assetManager,
			this.id,
			this.items,
			newPose,
			{
				leftArm,
				rightArm,
			},
			view,
			this.safemode,
		);
	}

	public produceWithItems(newItems: AppearanceItems<WearableAssetType>): AssetFrameworkCharacterState {
		return new AssetFrameworkCharacterState(
			this.assetManager,
			this.id,
			newItems,
			this.pose,
			this.arms,
			this.view,
			this.safemode,
		);
	}

	public produceWithPose(pose: PartialAppearancePose, type: BoneType | true, missingAsZero: boolean): AssetFrameworkCharacterState {
		let resultArms = this.arms;
		let resultPose = this.pose;

		const [changed, arms] = this._newArmsPose(pose);
		if (changed) {
			resultArms = arms;
		}
		const { bones } = pose;
		if (bones) {
			const newPose = new Map(resultPose);
			for (const [bone, state] of newPose.entries()) {
				if (type !== true && state.definition.type !== type)
					continue;
				if (!missingAsZero && bones[state.definition.name] == null)
					continue;

				newPose.set(bone, {
					definition: state.definition,
					rotation: _.clamp(bones[state.definition.name] || 0, BONE_MIN, BONE_MAX),
				});
			}
			resultPose = newPose;
		} else if (!changed) {
			return this;
		}

		return new AssetFrameworkCharacterState(
			this.assetManager,
			this.id,
			this.items,
			resultPose,
			resultArms,
			this.view,
			this.safemode,
		)
			.enforcePoseLimits();
	}

	public produceWithArmsPose(pose: Pick<PartialAppearancePose, 'arms' | 'leftArm' | 'rightArm'>): AssetFrameworkCharacterState {
		const [changed, arms] = this._newArmsPose(pose);
		if (!changed)
			return this;

		return new AssetFrameworkCharacterState(
			this.assetManager,
			this.id,
			this.items,
			this.pose,
			arms,
			this.view,
			this.safemode,
		)
			.enforcePoseLimits();
	}

	private _newArmsPose({ arms, leftArm: left, rightArm: right }: Pick<PartialAppearancePose, 'arms' | 'leftArm' | 'rightArm'>): [boolean, CharacterArmsPose] {
		const leftArm = { ...this.arms.leftArm, ...arms, ...left };
		const rightArm = { ...this.arms.rightArm, ...arms, ...right };
		const changed =
			!_.isEqual(this.arms.leftArm, leftArm) ||
			!_.isEqual(this.arms.rightArm, rightArm);

		return [changed, { leftArm, rightArm }];
	}

	public produceWithView(newView: CharacterView): AssetFrameworkCharacterState {
		if (this.view === newView)
			return this;

		return new AssetFrameworkCharacterState(
			this.assetManager,
			this.id,
			this.items,
			this.pose,
			this.arms,
			newView,
			this.safemode,
		);
	}

	public produceWithSafemode(value: Readonly<SafemodeData> | null): AssetFrameworkCharacterState {
		if (isEqual(this.safemode ?? null, value))
			return this;

		return new AssetFrameworkCharacterState(
			this.assetManager,
			this.id,
			this.items,
			this.pose,
			this.arms,
			this.view,
			freeze(value ?? undefined, true),
		);
	}

	public cleanupRoomDeviceWearables(roomInventory: AssetFrameworkRoomState | null): AssetFrameworkCharacterState {
		const cleanedUpItems = this.items.filter((item) => {
			if (item.isType('roomDeviceWearablePart')) {
				const link = item.roomDeviceLink;
				if (!roomInventory || !link)
					return false;

				// Target device must exist
				const device = roomInventory.items.find((roomItem) => roomItem.id === link.device);
				if (!device || !device.isType('roomDevice'))
					return false;

				// The device must have a matching slot
				if (device.asset.definition.slots[item.roomDeviceLink.slot]?.wearableAsset !== item.asset.id)
					return false;

				// The device must be deployed with this character in target slot
				if (!device.deployment || device.slotOccupancy.get(item.roomDeviceLink.slot) !== this.id)
					return false;
			}
			return true;
		});

		if (cleanedUpItems.length === this.items.length)
			return this;

		// Re-validate items as forceful removal might have broken dependencies
		const newItems = CharacterAppearanceLoadAndValidate(this.assetManager, cleanedUpItems);
		Assert(ValidateAppearanceItems(this.assetManager, newItems).success);

		return new AssetFrameworkCharacterState(
			this.assetManager,
			this.id,
			newItems,
			this.pose,
			this.arms,
			this.view,
			this.safemode,
		)
			.enforcePoseLimits();
	}

	public static createDefault(assetManager: AssetManager, characterId: CharacterId): AssetFrameworkCharacterState {
		return AssetFrameworkCharacterState.loadFromBundle(assetManager, characterId, undefined, undefined);
	}

	public static loadFromBundle(assetManager: AssetManager, characterId: CharacterId, bundle: AppearanceBundle | undefined, logger: Logger | undefined): AssetFrameworkCharacterState {
		bundle = AppearanceBundleSchema.parse(bundle ?? GetDefaultAppearanceBundle());

		// Load all items
		const loadedItems: Item[] = [];
		for (const itemBundle of bundle.items) {
			// Load asset and skip if unknown
			const asset = assetManager.getAssetById(itemBundle.asset);
			if (asset === undefined) {
				logger?.warning(`Skipping unknown asset ${itemBundle.asset}`);
				continue;
			}

			const item = assetManager.createItem(itemBundle.id, asset, itemBundle, logger);
			loadedItems.push(item);
		}

		// Validate and add all items
		const newItems = CharacterAppearanceLoadAndValidate(assetManager, loadedItems, logger);

		const pose = new Map<BoneName, BoneState>();
		for (const bone of assetManager.getAllBones()) {
			const value = bundle.bones[bone.name];
			pose.set(bone.name, {
				definition: bone,
				rotation: (value != null && Number.isInteger(value)) ? _.clamp(value, BONE_MIN, BONE_MAX) : 0,
			});
		}
		if (logger) {
			for (const k of Object.keys(bundle.bones)) {
				if (!pose.has(k)) {
					logger.warning(`Skipping unknown pose bone ${k}`);
				}
			}
		}

		// Create the final state
		let resultState = freeze(new AssetFrameworkCharacterState(
			assetManager,
			characterId,
			newItems,
			pose,
			{
				leftArm: _.cloneDeep(bundle.leftArm),
				rightArm: _.cloneDeep(bundle.rightArm),
			},
			bundle.view,
			bundle.safemode,
		), true);

		resultState = resultState.enforcePoseLimits();

		Assert(resultState.isValid(), 'State is invalid after load');

		return resultState;
	}
}
