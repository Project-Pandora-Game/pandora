import { z } from 'zod';
import type { IChatroomBackgroundData } from '../chatroom';
import { HexRGBAColorString } from '../validation';
import type { AppearanceArmPose, AppearancePose } from './state/characterState';
import type { BoneDefinitionCompressed, BoneName, BoneType, CharacterView, Condition, Coordinates, LayerImageOverride, LegsPose } from './graphics';
import type { AssetModuleDefinition } from './modules';
import type { AssetLockProperties, AssetProperties } from './properties';
import type { Satisfies } from '../utility';
import { Immutable, freeze, produce } from 'immer';
import type { AssetManager } from './assetManager';
import _ from 'lodash';
import { BONE_MAX, BONE_MIN } from './appearance';
import type { RoomDeviceProperties } from './roomDeviceProperties';
import type { AssetId } from './base';

// Each asset must have a size (bodyparts and only bodyparts have `bodypart` size)
// The size is used to make sure you cannot infinitely recurse storing items into one another
// To store item inside something, it must be strictly smaller than the item you are storing it in
export const AssetSizeSchema = z.enum(['small', 'medium', 'large', 'huge', 'bodypart']);
export type AssetSize = z.infer<typeof AssetSizeSchema>;
/** Numbers to compare size of what fits where in code */
export const AssetSizeMapping: Record<AssetSize, number> = {
	small: 1,
	medium: 2,
	large: 3,
	huge: 4,
	bodypart: 99,
};

export interface AssetDefinitionExtraArgs {
	bones: BoneName;
	bodyparts: string;
	attributes: string;
	colorGroups: string;
}

export interface AssetDefinitionPoseLimit<A extends AssetDefinitionExtraArgs = AssetDefinitionExtraArgs> {
	bones?: Partial<Record<A['bones'], number | [number, number][]>>;
	arms?: Partial<AppearanceArmPose>;
	leftArm?: Partial<AppearanceArmPose>;
	rightArm?: Partial<AppearanceArmPose>;
	legs?: LegsPose | LegsPose[];
	view?: CharacterView;
}

export type AssetDefinitionPoseLimits<A extends AssetDefinitionExtraArgs = AssetDefinitionExtraArgs> = AssetDefinitionPoseLimit<A> & {
	options?: [AssetDefinitionPoseLimits<A>, AssetDefinitionPoseLimits<A>, ...AssetDefinitionPoseLimits<A>[]];
};

export interface AssetColorization<A extends AssetDefinitionExtraArgs = AssetDefinitionExtraArgs> {
	/** Name that describes the meaning of this color to user, `null` if it cannot be colored by user */
	name: string | null;
	default: HexRGBAColorString;
	/**
	 * Color inheritance group
	 * If name is `null`, the color will always be inherited from this group, otherwise it depends on the item properties
	 */
	group?: A['colorGroups'];
	/**
	 * Controls how low can the alpha of this color be
	 *  - if the value is not present this color cannot be transparent
	 *  - range: [0, 255]
	 *
	 * @default 255
	 */
	minAlpha?: number;
}

export type AssetType =
	// Personal items are items worn on person, not spanning multiple persons or interacting with a room
	'personal' |
	// Room devices are items placed in the room
	'roomDevice' |
	// Room device wearable parts are hidden items applied on character when they enter device
	'roomDeviceWearablePart' |
	// Lock items are items that can be used to lock other items
	'lock';

export const WEARABLE_ASSET_TYPES = ['personal', 'roomDeviceWearablePart'] as const satisfies readonly AssetType[];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface AssetBaseDefinition<Type extends AssetType, A extends AssetDefinitionExtraArgs = AssetDefinitionExtraArgs> {
	/** Unique id of this asset */
	id: AssetId;

	/** The visible name of this asset */
	name: string;

	/** What type of asset this asset is */
	type: Type;

	/**
	 * Size of this item. Affects mainly which things it can fit into.
	 *
	 * Sizing logic:
	 * - Is it a bodypart? -> `bodypart`
	 * - Can it fit into a box (20cm x 20cm)? -> `small`
	 * - Can it fit into a backpack? -> `medium`
	 * - Can it fit into a 1m x 1m crate? -> `large`
	 * - Is it a crate or bigger? -> `huge`
	 *
	 * If this item is a bodypart, then and **only** then the size **must** be `'bodypart'`
	 */
	size: AssetSize;

	/**
	 * Preview image inside the wardrobe
	 *  - `<image path>` if this item has a preview
	 *  - `null` if this item does not have a preview
	 *  - `undefined` temporarily until all previews are added
	 */
	preview?: string | null;
}

export interface PersonalAssetDefinition<A extends AssetDefinitionExtraArgs = AssetDefinitionExtraArgs> extends AssetProperties<A>, AssetBaseDefinition<'personal', A> {
	/**
	 * If this asset can be worn on body directly.
	 * @default true
	 */
	wearable?: boolean;

	/**
	 * If this asset can be used when randomly picking part needed to fit
	 * @default false
	 */
	allowRandomizerUsage?: boolean;

	/**
	 * Chat specific settings for this asset
	 *
	 * @see https://github.com/Project-Pandora-Game/pandora/blob/master/pandora-common/src/chatroom/chatActions.ts
	 */
	chat?: {
		/** How items of this asset are referred to in chat (defaults to asset's name) */
		chatDescriptor?: string;
		/** Message for when this item is added (defaults to `itemAdd`) */
		actionAdd?: string;
		/** Message for when this item is spawned and immediately added (defaults to `itemAddCreate`) */
		actionAddCreate?: string;
		/** Message for when this item is removed (defaults to `itemRemove`) */
		actionRemove?: string;
		/** Message for when this item is removed and immediately deleted (defaults to `itemRemoveDelete`) */
		actionRemoveDelete?: string;
		/** Message for when this item is attached to something (defaults to `itemAttach`) */
		actionAttach?: string;
		/** Message for when this item is removed (defaults to `itemDetach`) */
		actionDetach?: string;
	};

	/** If this asset is a bodypart, `undefined` if not. */
	bodypart?: A['bodyparts'];

	/** Configuration of user-configurable asset colorization */
	colorization?: Record<string, AssetColorization<A>>;

	/** Which colorization group should be used for item's ribbon in inventory (if not specified defaults to first color group) */
	colorRibbonGroup?: string;

	/**
	 * Modules this asset has
	 */
	modules?: Record<string, AssetModuleDefinition<AssetProperties<A>>>;

	/** If this item has any graphics to be loaded or is only virtual */
	hasGraphics: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type RoomDeviceSlot<A extends AssetDefinitionExtraArgs = AssetDefinitionExtraArgs> = {
	/** Visible name of this slot */
	name: string;
	wearableAsset: AssetId;
};

export type IRoomDeviceGraphicsLayerSprite = {
	type: 'sprite';
	image: string;
	imageOverrides?: LayerImageOverride[];
	/** Name of colorization key used to color this sprite layer */
	colorizationKey?: string;
	/**
	 * Offset of this sprite relative to cage's origin point
	 * @default { x: 0, y: 0 }
	 */
	offset?: Coordinates;
	offsetOverrides?: {
		offset: Coordinates;
		condition: Condition;
	}[];
};

export type IRoomDeviceGraphicsCharacterPosition = {
	offsetX: number;
	offsetY: number;
	/**
	 * Offset to apply to the character's pivot. (point around which character rotates and turns around)
	 * @see {CHARACTER_PIVOT_POSITION}
	 * @default
	 * { x: 0, y: 0 }
	 */
	pivotOffset?: Coordinates;
	/**
	 * Is the factor by which the character is made bigger or smaller inside the room device slot,
	 * compared to this room device scaled inside the room
	 * @default 1
	 */
	relativeScale?: number;
	/**
	 * Prevents pose from changing character's offset while inside this room device slot
	 * (for slots that allow different poses, but require precision)
	 * @default false
	 */
	disablePoseOffset?: boolean;
};

export type IRoomDeviceGraphicsCharacterPositionOverride = {
	position: IRoomDeviceGraphicsCharacterPosition;
	condition: Condition;
};

export type IRoomDeviceGraphicsLayerSlot = {
	type: 'slot';
	/**
	 * Is the name of the character slot that is drawn on this layer.
	 */
	slot: string;
	characterPosition: IRoomDeviceGraphicsCharacterPosition;
	characterPositionOverrides?: IRoomDeviceGraphicsCharacterPositionOverride[];
};

export type IRoomDeviceGraphicsLayer = IRoomDeviceGraphicsLayerSprite | IRoomDeviceGraphicsLayerSlot;

export interface RoomDeviceAssetDefinition<A extends AssetDefinitionExtraArgs = AssetDefinitionExtraArgs> extends AssetBaseDefinition<'roomDevice', A> {
	/** Configuration of user-configurable asset colorization */
	colorization?: Record<string, Omit<AssetColorization<A>, 'group'>>;
	/** Which colorization group should be used for item's ribbon in inventory (if not specified defaults to first color group) */
	colorRibbonGroup?: string;
	/** Position of centerpoint relative to top-left corner of assets */
	pivot: Coordinates;
	/** Slots that can be entered by characters */
	slots: Record<string, RoomDeviceSlot<A>>;
	/** Modules this device has */
	modules?: Record<string, AssetModuleDefinition<RoomDeviceProperties<A>>>;
	/** The graphical display of the device */
	graphicsLayers: IRoomDeviceGraphicsLayer[];
	/** Attributes that are used strictly for filtering, no effect on character */
	staticAttributes?: (A['attributes'])[];
	/** Extra pose presets available when inside this device */
	posePresets?: AssetsPosePreset<A['bones']>[];
	/**
	 * Chat specific settings for this asset
	 *
	 * @see https://github.com/Project-Pandora-Game/pandora/blob/master/pandora-common/src/chatroom/chatActions.ts
	 */
	chat?: {
		/** How items of this asset are referred to in chat (defaults to asset's name) */
		chatDescriptor?: string;
		/** Message for when this device is deployed inside the room */
		actionDeploy?: string;
		/** Message for when this device is stored from the room */
		actionStore?: string;
		/**
		 * Message for when character enters a this device's slot
		 * @note You can use `ROOM_DEVICE_SLOT` to get name of the slot
		 */
		actionSlotEnter?: string;
		/**
		 * Message for when character leaves a this device's slot
		 * @note You can use `ROOM_DEVICE_SLOT` to get name of the slot
		 */
		actionSlotLeave?: string;
	};
}

export interface RoomDeviceWearablePartAssetDefinition<A extends AssetDefinitionExtraArgs = AssetDefinitionExtraArgs> extends AssetProperties<A>, AssetBaseDefinition<'roomDeviceWearablePart', A> {
	/** If this item has any graphics to be loaded or is only virtual */
	hasGraphics: boolean;
	/** Extra pose presets available when wearing this asset, extends device's pose presets */
	posePresets?: AssetsPosePreset<A['bones']>[];
	/**
	 * Chat specific settings for this asset
	 *
	 * @see https://github.com/Project-Pandora-Game/pandora/blob/master/pandora-common/src/chatroom/chatActions.ts
	 */
	chat?: {
		/** How items of this asset are referred to in chat (defaults to asset's name) */
		chatDescriptor?: string;
	};
}

export interface LockAssetDefinition<A extends AssetDefinitionExtraArgs = AssetDefinitionExtraArgs> extends AssetBaseDefinition<'lock', A> {
	/** Properties when the lock is unlocked */
	unlocked?: AssetLockProperties<A>;
	/** Properties when the lock is locked */
	locked?: AssetLockProperties<A>;
	/** Configuration to enable password on this lock */
	password?: {
		/** Length of the password */
		length: number | [number, number];
		/**
		 * Allowed characters in the password
		 *  - `numeric` - only numbers
		 *  - `letters` - only letters (case insensitive)
		 *  - `alphanumeric` - only letters and numbers (case insensitive)
		 *  - `text` - any text (numbers + case insensitive letters + spaces, dashes, underscores, ...)
		 */
		format: 'numeric' | 'letters' | 'alphanumeric' | 'text';
	};
	/**
	 * Chat specific settings for this asset
	 *
	 * @see https://github.com/Project-Pandora-Game/pandora/blob/master/pandora-common/src/chatroom/chatActions.ts
	 */
	chat?: {
		/** How items of this asset are referred to in chat (defaults to asset's name) */
		chatDescriptor?: string;
		/** Message for when this item is locked */
		actionLock?: string;
		/** Message for when this item is unlocked */
		actionUnlock?: string;
	};
	/**
	 * Text to show when the lock is locked.
	 *
	 * To disable this text, set it to '' (empty string)
	 *
	 * Replacements:
	 *  - CHARACTER_NAME is replaced with the name of the character
	 *  - CHARACTER_ID is replaced with the ID of the character
	 *  - CHARACTER is replaced with `CHARACTER_NAME (CHARACTER_ID)`
	 *  - TIME is replaced with the time the variant was selected
	 *  - TIME_PASSED is replaced with the time passed since the variant was selected
	 *
	 * @default 'Locked by CHARACTER at TIME'
	 */
	lockedText?: string;
	/** If this item has any graphics to be loaded or is only virtual */
	hasGraphics: boolean;
}

export type AssetDefinitionTypeMap<A extends AssetDefinitionExtraArgs = AssetDefinitionExtraArgs> =
	Satisfies<
		{
			personal: PersonalAssetDefinition<A>;
			roomDevice: RoomDeviceAssetDefinition<A>;
			roomDeviceWearablePart: RoomDeviceWearablePartAssetDefinition<A>;
			lock: LockAssetDefinition<A>;
		},
		{
			[type in AssetType]: AssetBaseDefinition<type, A>;
		}
	>;

//#region Typing helpers
export type AssetDefinition<Type extends AssetType = AssetType, A extends AssetDefinitionExtraArgs = AssetDefinitionExtraArgs> = AssetDefinitionTypeMap<A>[Type];

export type WearableAssetType = (typeof WEARABLE_ASSET_TYPES)[number];
export function IsWearableAssetDefinition(definition: Immutable<AssetDefinition>): definition is AssetDefinition<WearableAssetType> {
	const arr: readonly AssetType[] = WEARABLE_ASSET_TYPES;
	return arr.includes(definition.type);
}
//#endregion

/** Definition of bodypart */
export interface AssetBodyPart {
	/** The identifier of this bodypart */
	name: string;
	/** If there needs to be at least one asset of this bodypart equipped at all times */
	required: boolean;
	/** If this bodypart allows multiple assets or requires at most one */
	allowMultiple: boolean;
	/** If changes to this bodypart are not considered as "body changes", lessening restrictions */
	adjustable: boolean;
}

export type PartialAppearancePose<Bones extends BoneName = BoneName> = {
	bones?: Partial<Record<Bones, number>>;
	arms?: Partial<AppearanceArmPose>;
	leftArm?: Partial<AppearanceArmPose>;
	rightArm?: Partial<AppearanceArmPose>;
	legs?: LegsPose;
	view?: CharacterView;
};

export function MergePartialAppearancePoses(base: Immutable<PartialAppearancePose>, extend?: Immutable<PartialAppearancePose>): PartialAppearancePose {
	if (extend == null)
		return base;

	return {
		bones: { ...base.bones, ...extend.bones },
		arms: { ...base.arms, ...extend.arms },
		leftArm: { ...base.leftArm, ...extend.leftArm },
		rightArm: { ...base.rightArm, ...extend.rightArm },
		legs: base.legs ?? extend.legs,
		view: base.view ?? extend.view,
	};
}

export function ProduceAppearancePose(
	basePose: Immutable<AppearancePose>,
	{
		assetManager,
		boneTypeFilter,
		missingBonesAsZero = false,
	}: {
		assetManager: AssetManager;
		boneTypeFilter?: BoneType;
		/** @default false */
		missingBonesAsZero?: boolean;
	},
	...changes: [(PartialAppearancePose | AssetsPosePreset), ...(PartialAppearancePose | AssetsPosePreset)[]]
): Immutable<AppearancePose> {
	const pose = changes.reduce(MergePartialAppearancePoses);

	return produce(basePose, (draft) => {
		// Update view
		if (pose.view != null) {
			draft.view = pose.view;
		}

		// Update arms
		{
			const leftArm = { ...basePose.leftArm, ...pose.arms, ...pose.leftArm };
			const rightArm = { ...basePose.rightArm, ...pose.arms, ...pose.rightArm };
			const armsChanged =
				!_.isEqual(basePose.leftArm, leftArm) ||
				!_.isEqual(basePose.rightArm, rightArm);

			if (armsChanged) {
				draft.leftArm = freeze(leftArm, true);
				draft.rightArm = freeze(rightArm, true);
			}
		}

		// Update legs
		if (pose.legs != null) {
			draft.legs = pose.legs;
		}

		// Update bones
		if (pose.bones != null) {
			for (const bone of assetManager.getAllBones()) {
				const newValue = pose.bones[bone.name];

				if (boneTypeFilter !== undefined && bone.type !== boneTypeFilter)
					continue;
				if (!missingBonesAsZero && newValue == null)
					continue;

				draft.bones[bone.name] = (newValue != null && Number.isInteger(newValue)) ? _.clamp(newValue, BONE_MIN, BONE_MAX) : 0;
			}
		}
	});
}

export type AssetsPosePreset<Bones extends BoneName = BoneName> = PartialAppearancePose<Bones> & {
	name: string;
	optional?: PartialAppearancePose<Bones>;
};

export type AssetsPosePresets<Bones extends BoneName = BoneName> = {
	category: string;
	poses: AssetsPosePreset<Bones>[];
}[];

export type AssetAttributeDefinition<A extends AssetDefinitionExtraArgs = AssetDefinitionExtraArgs> = {
	name: string;
	description: string;
	icon?: string;
	useAsWardrobeFilter?: {
		tab: 'item' | 'body' | 'room';
		excludeAttributes?: readonly A['attributes'][];
	};
};

/** Data for randomly generating sensible appearance */
export type AppearanceRandomizationData<A extends AssetDefinitionExtraArgs = AssetDefinitionExtraArgs> = {
	/** List of attributes for generating body */
	body: readonly A['attributes'][];
	/** List of attributes for generating clothing */
	clothes: readonly A['attributes'][];
};

export type IChatroomBackgroundInfo = IChatroomBackgroundData & {
	/** The unique identifier for this background */
	id: string;
	/** The visible name for this background */
	name: string;
	/** The preview image for this background */
	preview: string;
	/** The tags that apply to this background */
	tags: string[];
};

export interface BackgroundTagDefinition {
	name: string;
	category: string;
}

export interface AssetsDefinitionFile {
	assets: Record<AssetId, AssetDefinition>;
	bones: Record<string, BoneDefinitionCompressed>;
	posePresets: AssetsPosePresets;
	bodyparts: AssetBodyPart[];
	graphicsId: string;
	backgroundTags: Record<string, BackgroundTagDefinition>;
	backgrounds: IChatroomBackgroundInfo[];
	attributes: Record<string, AssetAttributeDefinition>;
	randomization: AppearanceRandomizationData;
}
