import { AppearanceItemProperties, AppearanceItems, AppearanceValidationResult, CharacterAppearanceLoadAndValidate, ValidateAppearanceItems } from '../appearanceValidation';
import { AssetsPosePreset, MergePartialAppearancePoses, PartialAppearancePose, ProduceAppearancePose, WearableAssetType } from '../definitions';
import { Assert, IsNotNullable, MemoizeNoArg } from '../../utility';
import { ZodArrayWithInvalidDrop } from '../../validation';
import { Immutable, freeze } from 'immer';
import { z } from 'zod';
import { ArmFingersSchema, ArmPoseSchema, ArmRotationSchema, BoneName, BoneNameSchema, BoneState, BoneType, CharacterView, CharacterViewSchema, LegsPoseSchema } from '../graphics';
import { Item, ItemBundleSchema } from '../item';
import { AssetManager } from '../assetManager';
import { BONE_MAX, BONE_MIN, GetDefaultAppearanceBundle, GetDefaultAppearancePose } from '../appearance';
import { Logger } from '../../logging';
import _, { isEqual } from 'lodash';
import { AssetFrameworkRoomState } from './roomState';
import { CharacterId } from '../../character';
import type { IExportOptions } from '../modules/common';

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
	legs: LegsPoseSchema.default('standing'),
	view: CharacterViewSchema.catch('front'),
});
export type AppearancePose = z.infer<typeof AppearancePoseSchema>;

export const AppearanceBundleSchema = z.object({
	requestedPose: AppearancePoseSchema.catch(() => GetDefaultAppearancePose()),
	items: ZodArrayWithInvalidDrop(ItemBundleSchema, z.record(z.unknown())),
	safemode: SafemodeDataSchema.optional(),
	clientOnly: z.boolean().optional(),
});
export type AppearanceBundle = z.infer<typeof AppearanceBundleSchema>;
export type AppearanceClientBundle = AppearanceBundle & { clientOnly: true; };

export type AppearanceCharacterPose = ReadonlyMap<BoneName, BoneState>;

type AssetFrameworkCharacterStateProps = {
	readonly assetManager: AssetManager;
	readonly id: CharacterId;
	readonly items: AppearanceItems<WearableAssetType>;
	readonly requestedPose: AppearancePose;
	readonly safemode: SafemodeData | undefined;
};

/**
 * State of an character. Immutable.
 */
export class AssetFrameworkCharacterState implements AssetFrameworkCharacterStateProps {
	public readonly type = 'character';
	public readonly assetManager: AssetManager;

	public readonly id: CharacterId;
	public readonly items: AppearanceItems<WearableAssetType>;
	public readonly requestedPose: Immutable<AppearancePose>;
	public readonly safemode: SafemodeData | undefined;

	public get actualPose(): Immutable<AppearancePose> {
		return this._generateActualPose();
	}

	private constructor(props: AssetFrameworkCharacterStateProps);
	private constructor(old: AssetFrameworkCharacterState, override: Partial<AssetFrameworkCharacterStateProps>);
	private constructor(props: AssetFrameworkCharacterStateProps, override: Partial<AssetFrameworkCharacterStateProps> = {}) {
		this.assetManager = override.assetManager ?? props.assetManager;
		this.id = override.id ?? props.id;
		this.items = override.items ?? props.items;
		this.requestedPose = override.requestedPose ?? props.requestedPose;
		// allow override safemode with undefined (override: { safemode: undefined })
		this.safemode = 'safemode' in override ? override.safemode : props.safemode;
	}

	public isValid(roomState: AssetFrameworkRoomState | null): boolean {
		return this.validate(roomState).success;
	}

	public validate(roomState: AssetFrameworkRoomState | null): AppearanceValidationResult {
		{
			const r = ValidateAppearanceItems(this.assetManager, this.items, roomState);
			if (!r.success)
				return r;
		}

		return {
			success: true,
		};
	}

	public exportToBundle(options: IExportOptions = {}): AppearanceBundle {
		return {
			items: this.items.map((item) => item.exportToBundle(options)),
			requestedPose: _.cloneDeep(this.requestedPose),
			safemode: this.safemode,
		};
	}

	public exportToClientBundle(options: IExportOptions = {}): AppearanceClientBundle {
		options.clientOnly = true;
		return {
			items: this.items.map((item) => item.exportToBundle(options)),
			requestedPose: _.cloneDeep(this.requestedPose),
			safemode: this.safemode,
			clientOnly: true,
		};
	}

	@MemoizeNoArg
	private _generateActualPose(): Immutable<AppearancePose> {
		const limits = AppearanceItemProperties(this.items).limits;
		if (!limits || limits.hasNoLimits())
			return this.requestedPose;

		const { changed, pose } = limits.force(this.requestedPose);
		if (!changed)
			return this.requestedPose;

		return freeze(pose, true);
	}

	public getRequestedPoseBoneValue(bone: string): number {
		// Asserts existence of bone
		void this.assetManager.getBoneByName(bone);

		return this.requestedPose.bones[bone] || 0;
	}

	public getActualPoseBoneValue(bone: string): number {
		// Asserts existence of bone
		void this.assetManager.getBoneByName(bone);

		return this.actualPose.bones[bone] || 0;
	}

	public produceWithItems(newItems: AppearanceItems<WearableAssetType>): AssetFrameworkCharacterState {
		return new AssetFrameworkCharacterState(this, { items: newItems });
	}

	public produceWithPose(pose: PartialAppearancePose, type: BoneType | true, missingAsZero: boolean = false): AssetFrameworkCharacterState {
		const resultPose = ProduceAppearancePose(
			this.requestedPose,
			{
				assetManager: this.assetManager,
				boneTypeFilter: type === true ? undefined : type,
				missingBonesAsZero: missingAsZero,
			},
			pose,
		);

		// Return current if no change
		if (resultPose === this.requestedPose)
			return this;

		return new AssetFrameworkCharacterState(this, { requestedPose: resultPose });
	}

	public produceWithPosePreset(preset: AssetsPosePreset): AssetFrameworkCharacterState {
		const result = this.produceWithPose(preset, 'pose');

		if (preset.optional == null)
			return result;

		return this.produceWithPose(MergePartialAppearancePoses(preset, preset.optional), 'pose');
	}

	public produceWithView(newView: CharacterView): AssetFrameworkCharacterState {
		return this.produceWithPose({
			view: newView,
		}, true);
	}

	public produceWithSafemode(value: Readonly<SafemodeData> | null): AssetFrameworkCharacterState {
		if (isEqual(this.safemode ?? null, value))
			return this;

		return new AssetFrameworkCharacterState(this, { safemode: freeze(value ?? undefined, true) });
	}

	public updateRoomStateLink(roomInventory: AssetFrameworkRoomState | null): AssetFrameworkCharacterState {
		const updatedItems = this.items.map((item) => {
			if (item.isType('roomDeviceWearablePart')) {
				const link = item.roomDeviceLink;
				if (!roomInventory || !link)
					return null;

				// Target device must exist
				const device = roomInventory.items.find((roomItem) => roomItem.id === link.device);
				if (!device || !device.isType('roomDevice'))
					return null;

				// The device must have a matching slot
				if (device.asset.definition.slots[item.roomDeviceLink.slot]?.wearableAsset !== item.asset.id)
					return null;

				// The device must be deployed with this character in target slot
				if (!device.deployment || device.slotOccupancy.get(item.roomDeviceLink.slot) !== this.id)
					return null;

				return item.updateRoomStateLink(device);
			}
			return item;
		}).filter(IsNotNullable);

		if (
			updatedItems.length === this.items.length &&
			updatedItems.every((item, i) => this.items[i] === item)
		) {
			return this;
		}

		// Re-validate items as forceful removal might have broken dependencies
		const newItems = CharacterAppearanceLoadAndValidate(this.assetManager, updatedItems, roomInventory);
		Assert(ValidateAppearanceItems(this.assetManager, newItems, roomInventory).success);

		return new AssetFrameworkCharacterState(this, {
			items: newItems,
		});
	}

	public static createDefault(assetManager: AssetManager, characterId: CharacterId): AssetFrameworkCharacterState {
		return AssetFrameworkCharacterState.loadFromBundle(assetManager, characterId, undefined, null, undefined);
	}

	public static loadFromBundle(assetManager: AssetManager, characterId: CharacterId, bundle: AppearanceBundle | undefined, roomState: AssetFrameworkRoomState | null, logger: Logger | undefined): AssetFrameworkCharacterState {
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

			let item = assetManager.createItem(itemBundle.id, asset, itemBundle, logger);

			// Properly link room device wearable parts
			if (item.isType('roomDeviceWearablePart')) {
				const link = item.roomDeviceLink;
				const device = roomState?.items.find((roomItem) => roomItem.id === link?.device);
				if (device?.isType('roomDevice')) {
					item = item.updateRoomStateLink(device);
				}
			}

			loadedItems.push(item);
		}

		// Validate and add all items
		const newItems = CharacterAppearanceLoadAndValidate(assetManager, loadedItems, roomState, logger);

		// Load pose
		const requestedPose = _.cloneDeep(bundle.requestedPose);
		// Load the bones manually, as they might change and are not validated by Zod; instead depend on assetManager
		requestedPose.bones = {};
		for (const bone of assetManager.getAllBones()) {
			const value = bundle.requestedPose.bones[bone.name];
			requestedPose.bones[bone.name] = (value != null && Number.isInteger(value)) ? _.clamp(value, BONE_MIN, BONE_MAX) : 0;
		}
		if (logger) {
			for (const k of Object.keys(bundle.requestedPose.bones)) {
				if (requestedPose.bones[k] == null) {
					logger.warning(`Skipping unknown pose bone ${k}`);
				}
			}
		}

		// Create the final state
		const resultState = freeze(
			new AssetFrameworkCharacterState({
				assetManager,
				id: characterId,
				items: newItems,
				requestedPose,
				safemode: bundle.safemode,
			}).updateRoomStateLink(roomState),
			true,
		);

		Assert(resultState.isValid(roomState), 'State is invalid after load');

		return resultState;
	}
}
