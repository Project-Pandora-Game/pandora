import { Immutable, freeze } from 'immer';
import { clamp, cloneDeep, isEqual } from 'lodash-es';
import type { Writable } from 'type-fest';
import type { CharacterId } from '../../character/index.ts';
import { RedactSensitiveActionData } from '../../gameLogic/actionLogic/actionUtils.ts';
import type { Logger } from '../../logging/logger.ts';
import type { SpaceId } from '../../space/index.ts';
import { Assert, CloneDeepMutable, IsNotNullable, MemoizeNoArg } from '../../utility/misc.ts';
import { AppearanceItemProperties, AppearanceValidationResult, CharacterAppearanceLoadAndValidate, ValidateAppearanceItems } from '../appearanceValidation.ts';
import type { AssetManager } from '../assetManager.ts';
import { WearableAssetType } from '../definitions.ts';
import { BoneType } from '../graphics/index.ts';
import { ApplyAppearanceItemsDeltaBundle, CalculateAppearanceItemsDeltaBundle, Item, type AppearanceItems, type ItemRoomDeviceWearablePart } from '../item/index.ts';
import type { IExportOptions } from '../modules/common.ts';
import { AppearancePose, AssetsPosePreset, BONE_MAX, BONE_MIN, CalculateAppearancePosesDelta, MergePartialAppearancePoses, PartialAppearancePose, ProduceAppearancePose } from './characterStatePose.ts';
import { AppearanceBundleSchema, GetDefaultAppearanceBundle, GetRestrictionOverrideConfig, type AppearanceBundle, type AppearanceClientBundle, type AppearanceClientDeltaBundle, type CharacterActionAttempt, type RestrictionOverride } from './characterStateTypes.ts';
import type { AssetFrameworkRoomState } from './roomState.ts';

type AssetFrameworkCharacterStateProps = {
	readonly assetManager: AssetManager;
	readonly id: CharacterId;
	readonly items: AppearanceItems<WearableAssetType>;
	readonly requestedPose: AppearancePose;
	readonly restrictionOverride?: RestrictionOverride;
	readonly attemptingAction: Immutable<CharacterActionAttempt> | null;
	/** Character's current space - mainly used for detecting space change (as shard has no control over that) and resetting relevant data when needed. */
	readonly space: SpaceId | null;
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
	public readonly restrictionOverride?: RestrictionOverride;

	public readonly attemptingAction: Immutable<CharacterActionAttempt> | null;
	public readonly space: SpaceId | null;

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
		// allow override restrictionOverride with undefined (override: { restrictionOverride: undefined })
		this.restrictionOverride = 'restrictionOverride' in override ? override.restrictionOverride : props.restrictionOverride;
		this.attemptingAction = override.attemptingAction !== undefined ? override.attemptingAction : props.attemptingAction;
		this.space = override.space !== undefined ? override.space : props.space;
	}

	public isValid(roomState: AssetFrameworkRoomState): boolean {
		return this.validate(roomState).success;
	}

	public validate(roomState: AssetFrameworkRoomState): AppearanceValidationResult {
		// We expect that character is always in a specific state and updated to match it
		if (roomState.spaceId !== this.space) {
			return {
				success: false,
				error: {
					problem: 'invalid',
				},
			};
		}

		{
			const r = ValidateAppearanceItems(this.assetManager, this.items, roomState);
			if (!r.success)
				return r;
		}

		return {
			success: true,
		};
	}

	public exportToBundle(): AppearanceBundle {
		return {
			items: this.items.map((item) => item.exportToBundle({})),
			requestedPose: cloneDeep(this.requestedPose),
			restrictionOverride: this.restrictionOverride,
			attemptingAction: CloneDeepMutable(this.attemptingAction) ?? undefined,
			space: this.space,
		};
	}

	public exportToClientBundle(options: IExportOptions = {}): AppearanceClientBundle {
		options.clientOnly = true;
		return {
			items: this.items.map((item) => item.exportToBundle(options)),
			requestedPose: cloneDeep(this.requestedPose),
			restrictionOverride: this.restrictionOverride,
			attemptingAction: this.attemptingAction != null ? ({
				action: RedactSensitiveActionData(this.attemptingAction.action),
				start: this.attemptingAction.start,
				finishAfter: this.attemptingAction.finishAfter,
			}) : undefined,
			space: this.space,
			clientOnly: true,
		};
	}

	public exportToClientDeltaBundle(originalState: AssetFrameworkCharacterState, options: IExportOptions = {}): AppearanceClientDeltaBundle {
		Assert(this.assetManager === originalState.assetManager);
		Assert(this.id === originalState.id);
		options.clientOnly = true;

		const result: AppearanceClientDeltaBundle = {};

		if (this.items !== originalState.items) {
			result.items = CalculateAppearanceItemsDeltaBundle(originalState.items, this.items, options);
		}
		if (this.requestedPose !== originalState.requestedPose) {
			result.requestedPose = cloneDeep(CalculateAppearancePosesDelta(this.assetManager, originalState.requestedPose, this.requestedPose));
		}
		if (this.restrictionOverride !== originalState.restrictionOverride) {
			result.restrictionOverride = this.restrictionOverride ?? null;
		}
		if (this.attemptingAction !== originalState.attemptingAction) {
			result.attemptingAction = this.attemptingAction != null ? ({
				action: RedactSensitiveActionData(this.attemptingAction.action),
				start: this.attemptingAction.start,
				finishAfter: this.attemptingAction.finishAfter,
			}) : null;
		}
		if (this.space !== originalState.space) {
			result.space = this.space;
		}

		return result;
	}

	public applyClientDeltaBundle(bundle: AppearanceClientDeltaBundle, roomState: AssetFrameworkRoomState, logger: Logger | undefined): AssetFrameworkCharacterState {
		const update: Writable<Partial<AssetFrameworkCharacterStateProps>> = {};

		if (bundle.items !== undefined) {
			const newItems = ApplyAppearanceItemsDeltaBundle(this.assetManager, this.items, bundle.items, logger)
				.map((item) => {
					// Properly link room device wearable parts
					if (item.isType('roomDeviceWearablePart')) {
						const link = item.roomDeviceLink;
						const device = roomState?.items.find((roomItem) => roomItem.id === link?.device);
						if (device?.isType('roomDevice')) {
							item = item.updateRoomStateLink(device);
						}
					}

					return item;
				});

			Assert(newItems.every((it) => it.isWearable()), 'DESYNC: Received non-wearable item on character');
			update.items = newItems;
		}

		if (bundle.requestedPose !== undefined) {
			update.requestedPose = ProduceAppearancePose(
				this.requestedPose,
				{ assetManager: this.assetManager },
				bundle.requestedPose,
			);
		}

		if (bundle.restrictionOverride !== undefined) {
			update.restrictionOverride = bundle.restrictionOverride != null ? bundle.restrictionOverride : undefined;
		}

		if (bundle.attemptingAction !== undefined) {
			update.attemptingAction = bundle.attemptingAction;
		}
		if (bundle.space !== undefined) {
			update.space = bundle.space;
		}

		// Create the final state
		const resultState = freeze(
			new AssetFrameworkCharacterState(this, update).updateRoomStateLink(roomState, false),
			true,
		);

		Assert(resultState.isValid(roomState), 'State is invalid after delta update');
		return resultState;
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

	/**
	 * Looks for a room device wearable part on the character and returns it if it exists, otherwise returns `null`.
	 */
	public getRoomDeviceWearablePart(): ItemRoomDeviceWearablePart | null {
		const roomDeviceWearable = this.items.find((i) => i.isType('roomDeviceWearablePart'));
		return roomDeviceWearable != null ? roomDeviceWearable : null;
	}

	public produceWithItems(newItems: AppearanceItems<WearableAssetType>): AssetFrameworkCharacterState {
		return new AssetFrameworkCharacterState(this, { items: newItems });
	}

	public produceWithRequestedPose(requestedPose: AppearancePose): AssetFrameworkCharacterState {
		if (requestedPose === this.requestedPose)
			return this;

		return new AssetFrameworkCharacterState(this, { requestedPose });
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

		return this.produceWithRequestedPose(resultPose);
	}

	public produceWithPosePreset(preset: AssetsPosePreset): AssetFrameworkCharacterState {
		if (preset.optional != null)
			return this.produceWithPose(MergePartialAppearancePoses(preset, preset.optional), 'pose');

		return this.produceWithPose(preset, 'pose');
	}

	public produceWithRestrictionOverride(type: RestrictionOverride['type'] | 'normal', removeAllowLeaveAt?: boolean): AssetFrameworkCharacterState;
	public produceWithRestrictionOverride(value: RestrictionOverride): AssetFrameworkCharacterState;
	public produceWithRestrictionOverride(value?: RestrictionOverride['type'] | RestrictionOverride | 'normal', removeAllowLeaveAt: boolean = false): AssetFrameworkCharacterState {
		if (value === 'normal') {
			value = undefined;
		} else if (typeof value === 'string') {
			const type = value;

			let { allowLeaveAt } = GetRestrictionOverrideConfig(type);

			if (removeAllowLeaveAt)
				allowLeaveAt = 0;
			else if (allowLeaveAt > 0)
				allowLeaveAt += Date.now();

			value = {
				type,
				allowLeaveAt,
			};
		}

		if (isEqual(this.restrictionOverride, value))
			return this;

		return new AssetFrameworkCharacterState(this, { restrictionOverride: freeze(value, true) });
	}

	public produceWithAttemptedAction(action: Immutable<CharacterActionAttempt> | null): AssetFrameworkCharacterState {
		return new AssetFrameworkCharacterState(this, { attemptingAction: freeze(action, true) });
	}

	public updateRoomStateLink(roomInventory: AssetFrameworkRoomState, revalidate: boolean): AssetFrameworkCharacterState {
		let updatedItems: AppearanceItems<WearableAssetType> = this.items.map((item) => {
			if (item.isType('roomDeviceWearablePart')) {
				const link = item.roomDeviceLink;
				if (!link)
					return item.updateRoomStateLink(null);

				// Target device must exist
				const device = roomInventory.items.find((roomItem) => roomItem.id === link.device);
				if (!device || !device.isType('roomDevice') || device.slotOccupancy.get(item.roomDeviceLink.slot) !== this.id)
					return item.updateRoomStateLink(null);

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

		if (revalidate) {
			// Re-validate items as forceful removal might have broken dependencies
			updatedItems = CharacterAppearanceLoadAndValidate(this.assetManager, updatedItems, this, roomInventory);
			Assert(ValidateAppearanceItems(this.assetManager, updatedItems, roomInventory).success);
		}

		return new AssetFrameworkCharacterState(this, {
			items: updatedItems,
		});
	}

	public static createDefault(assetManager: AssetManager, characterId: CharacterId, roomState: AssetFrameworkRoomState): AssetFrameworkCharacterState {
		return AssetFrameworkCharacterState.loadFromBundle(assetManager, characterId, undefined, roomState, undefined);
	}

	public static loadFromBundle(
assetManager: AssetManager,
characterId: CharacterId,
bundle: AppearanceBundle | undefined,
roomState: AssetFrameworkRoomState,
logger: Logger | undefined,
): AssetFrameworkCharacterState {
const fixup = bundle?.clientOnly !== true;

		bundle = AppearanceBundleSchema.parse(bundle ?? GetDefaultAppearanceBundle());

		// Load all items
		const loadedItems: Item[] = [];
		for (const itemBundle of bundle.items) {
			// Load asset and skip if unknown
			const asset = assetManager.getAssetById(itemBundle.asset);
			if (asset === undefined) {
if (!fixup) {
					Assert(false, `DESYNC: Unknown asset ${itemBundle.asset}`);
				}
				logger?.warning(`Skipping unknown asset ${itemBundle.asset}`);
				continue;
			}

			let item = assetManager.loadItemFromBundle(asset, itemBundle, logger);

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
		let newItems: AppearanceItems<WearableAssetType>;
		if (fixup) {
newItems = CharacterAppearanceLoadAndValidate(assetManager, loadedItems, { id: characterId }, roomState, logger);
} else {
			Assert(loadedItems.every((it) => it.isWearable()), 'DESYNC: Received non-wearable item on character');
			newItems = loadedItems;
		}

		// Load pose
		const requestedPose = cloneDeep(bundle.requestedPose);
		// Load the bones manually, as they might change and are not validated by Zod; instead depend on assetManager
		requestedPose.bones = {};
		for (const bone of assetManager.getAllBones()) {
			const value = bundle.requestedPose.bones[bone.name];
			requestedPose.bones[bone.name] = (value != null && Number.isInteger(value)) ? clamp(value, BONE_MIN, BONE_MAX) : 0;
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
				restrictionOverride: bundle.restrictionOverride,
				attemptingAction: bundle.attemptingAction ?? null,
				space: roomState.spaceId,
			}).updateRoomStateLink(roomState, true),
			true,
		);

		Assert(resultState.isValid(roomState), 'State is invalid after load');

		return resultState;
	}
}
