import { Immutable, freeze } from 'immer';
import _, { isEqual } from 'lodash';
import type { CharacterId } from '../../character';
import { Logger } from '../../logging';
import { GenerateInitialRoomPosition, IsValidRoomPosition } from '../../space/room';
import { Assert, CloneDeepMutable, IsNotNullable, MemoizeNoArg } from '../../utility';
import { AppearanceItemProperties, AppearanceItems, AppearanceValidationResult, CharacterAppearanceLoadAndValidate, ValidateAppearanceItems } from '../appearanceValidation';
import type { AssetManager } from '../assetManager';
import { WearableAssetType } from '../definitions';
import { BoneType, CharacterView } from '../graphics';
import { Item } from '../item';
import type { IExportOptions } from '../modules/common';
import { AppearancePose, AssetsPosePreset, BONE_MAX, BONE_MIN, MergePartialAppearancePoses, PartialAppearancePose, ProduceAppearancePose } from './characterStatePose';
import { AppearanceBundleSchema, GetDefaultAppearanceBundle, GetRestrictionOverrideConfig, type AppearanceBundle, type AppearanceClientBundle, type CharacterSpacePosition, type RestrictionOverride } from './characterStateTypes';
import type { AssetFrameworkRoomState, RoomId } from './roomState';
import type { AssetFrameworkSpaceState } from './spaceState';

// Fix for pnpm resolution weirdness
import type { } from '../item/base';

type AssetFrameworkCharacterStateProps = {
	readonly assetManager: AssetManager;
	readonly id: CharacterId;
	readonly items: AppearanceItems<WearableAssetType>;
	readonly requestedPose: AppearancePose;
	readonly restrictionOverride?: RestrictionOverride;
	readonly position: Immutable<CharacterSpacePosition>;
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
	public readonly position: Immutable<CharacterSpacePosition>;

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
		this.position = override.position ?? props.position;
	}

	public isValid(spaceState: AssetFrameworkSpaceState): boolean {
		return this.validate(spaceState).success;
	}

	public validate(spaceState: AssetFrameworkSpaceState): AppearanceValidationResult {
		const room = spaceState.getRoomState(this.getCurrentRoomId());
		if (room == null) {
			return {
				success: false,
				error: {
					problem: 'characterUnknownRoom',
					character: this.id,
				},
			};
		}

		{
			const r = ValidateAppearanceItems(this.assetManager, this.items, this.getPhysicalRoom(spaceState));
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
			restrictionOverride: this.restrictionOverride,
			position: CloneDeepMutable(this.position),
		};
	}

	public exportToClientBundle(options: IExportOptions = {}): AppearanceClientBundle {
		options.clientOnly = true;
		return {
			items: this.items.map((item) => item.exportToBundle(options)),
			requestedPose: _.cloneDeep(this.requestedPose),
			restrictionOverride: this.restrictionOverride,
			position: CloneDeepMutable(this.position),
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

	public getCurrentRoomId(): RoomId {
		return this.position.roomId;
	}

	public getPhysicalRoom(spaceState: AssetFrameworkSpaceState): AssetFrameworkRoomState | null {
		if (this.position.type === 'normal') {
			return spaceState.getRoomState(this.getCurrentRoomId());
		}

		// Spectator is not physically in a room
		return null;
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

	public produceWithPosition(newPosition: CharacterSpacePosition): AssetFrameworkCharacterState {
		return new AssetFrameworkCharacterState(this, { position: CloneDeepMutable(newPosition) });
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

	public updateRoomStateLink(room: AssetFrameworkRoomState | null, revalidate: boolean): AssetFrameworkCharacterState {
		let updatedItems: AppearanceItems<WearableAssetType> = this.items.map((item) => {
			if (item.isType('roomDeviceWearablePart')) {
				const link = item.roomDeviceLink;
				if (!room || !link)
					return item.updateRoomStateLink(null);

				// Target device must exist
				const device = room.items.find((roomItem) => roomItem.id === link.device);
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
			updatedItems = CharacterAppearanceLoadAndValidate(this.assetManager, updatedItems, room);
			Assert(ValidateAppearanceItems(this.assetManager, updatedItems, room).success);
		}

		return new AssetFrameworkCharacterState(this, {
			items: updatedItems,
		});
	}

	public static createDefault(assetManager: AssetManager, characterId: CharacterId, spaceState: AssetFrameworkSpaceState): AssetFrameworkCharacterState {
		return AssetFrameworkCharacterState.loadFromBundle(assetManager, characterId, undefined, spaceState, undefined);
	}

	public static loadFromBundle(assetManager: AssetManager, characterId: CharacterId, bundle: AppearanceBundle | undefined, spaceState: AssetFrameworkSpaceState, logger: Logger | undefined): AssetFrameworkCharacterState {
		bundle = AppearanceBundleSchema.parse(bundle ?? GetDefaultAppearanceBundle());

		// Determinate current room
		let currentPosition: CharacterSpacePosition = bundle.position;
		let currentRoom: AssetFrameworkRoomState | null = spaceState.getRoomState(bundle.position.roomId);
		if (currentRoom == null) {
			// Do not log this problem; it occurs commonly whenever character switches spaces
			currentRoom = spaceState.getDefaultRoom();
		}

		Assert(currentRoom != null);

		if (
			currentPosition.roomId !== currentRoom.id ||
			(currentPosition.type === 'normal' && !IsValidRoomPosition(currentRoom.getResolvedBackground(), currentPosition.position))
		) {
			// TODO(spaces): Figure out logic for when to make character spectator by default
			currentPosition = {
				type: 'normal',
				roomId: currentRoom.id,
				position: GenerateInitialRoomPosition(currentRoom.getResolvedBackground()),
			};
		}

		const physicalRoom: AssetFrameworkRoomState | null = currentPosition.type === 'normal' ? currentRoom : null;

		// Load all items
		const loadedItems: Item[] = [];
		for (const itemBundle of bundle.items) {
			// Load asset and skip if unknown
			const asset = assetManager.getAssetById(itemBundle.asset);
			if (asset === undefined) {
				logger?.warning(`Skipping unknown asset ${itemBundle.asset}`);
				continue;
			}

			let item = assetManager.loadItemFromBundle(asset, itemBundle, logger);

			// Properly link room device wearable parts
			if (item.isType('roomDeviceWearablePart')) {
				const link = item.roomDeviceLink;
				const device = physicalRoom?.items.find((roomItem) => roomItem.id === link?.device);
				if (device?.isType('roomDevice')) {
					item = item.updateRoomStateLink(device);
				}
			}

			loadedItems.push(item);
		}

		// Validate and add all items
		const newItems = CharacterAppearanceLoadAndValidate(assetManager, loadedItems, physicalRoom, logger);

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
				restrictionOverride: bundle.restrictionOverride,
				position: currentPosition,
			}).updateRoomStateLink(physicalRoom, true),
			true,
		);

		Assert(resultState.isValid(spaceState), 'State is invalid after load');

		return resultState;
	}
}
