import { Immutable } from 'immer';
import * as z from 'zod';
import type { AssetPreferenceType } from '../character/index.ts';
import type { CharacterModifierSpecificTemplate, CharacterModifierType } from '../gameLogic/index.ts';
import type { LockSetup } from '../gameLogic/locks/lockSetup.ts';
import type { Satisfies } from '../utility/misc.ts';
import { HexRGBAColorString } from '../validation.ts';
import type { AssetId } from './base.ts';
import type { ArmFingers, ArmPose, ArmRotation, ArmSegmentOrder, BoneDefinitionCompressed, BoneName, CharacterView, Coordinates, LegSideOrder, LegsPose } from './graphics/index.ts';
import type { AssetModuleDefinition } from './modules.ts';
import type { AssetProperties } from './properties.ts';
import type { RoomDeviceProperties, RoomDeviceSlotProperties } from './roomDeviceProperties.ts';
import type { AssetsPosePreset, AssetsPosePresets, PartialAppearancePose } from './state/characterStatePose.ts';
import type { RoomBackgroundData, RoomPosition } from './state/roomGeometry.ts';
import type { AssetStateFlagCombination } from './stateFlags.ts';

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

export type AssetDefinitionArmPoseLimit = {
	position?: ArmPose | ArmPose[];
	rotation?: ArmRotation | ArmRotation[];
	fingers?: ArmFingers | ArmFingers[];
};

export type AssetDefinitionArmOrderPoseLimit = {
	upper?: ArmSegmentOrder | ArmSegmentOrder[];
};

export type AssetDefinitionLegsPosePoseLimit = {
	upper?: LegSideOrder | LegSideOrder[];
	pose?: LegsPose | LegsPose[];
};

export interface AssetDefinitionPoseLimit<A extends AssetDefinitionExtraArgs = AssetDefinitionExtraArgs> {
	bones?: Partial<Record<A['bones'], number | [number, number][]>>;
	arms?: AssetDefinitionArmPoseLimit;
	leftArm?: AssetDefinitionArmPoseLimit;
	rightArm?: AssetDefinitionArmPoseLimit;
	armsOrder?: AssetDefinitionArmOrderPoseLimit;
	legs?: AssetDefinitionLegsPosePoseLimit;
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
	/**
	 * List of keys to try if this color doesn't exist on an already existing item, in order of priority (first existing is used).
	 * Useful to migrate colors of existing items if colorization changes.
	 */
	migrateFrom?: string[];
}

export type AssetType =
	// Bodyparts are special items that form character's body. They cannot exist anywhere else but on the character and have a few unique limitations.
	'bodypart' |
	// Personal items are items worn on person, not spanning multiple persons or interacting with a room
	'personal' |
	// Room devices are items placed in the room
	'roomDevice' |
	// Room device wearable parts are hidden items applied on character when they enter device
	'roomDeviceWearablePart' |
	// Lock items are items that can be used to lock other items
	'lock';

export const WEARABLE_ASSET_TYPES = ['bodypart', 'personal', 'roomDeviceWearablePart'] as const satisfies readonly AssetType[];

/**
 * Describes info related to crediting assets to their creators.
 */
export interface AssetCreditsInfo {
	/** List of creator names to display for the asset. */
	credits: string[];
	/** Path relative to asset repository to this asset's definition. Used for "Go to source". */
	sourcePath: string;
}

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

	/**
	 * Override the standard asset preference 'normal' with a new default
	 *  - only 'maybe' and 'prevent' are allowed since 'favorite', 'normal', and 'doNotRender' does not make sense
	 */
	assetPreferenceDefault?: AssetPreferenceType & ('maybe' | 'prevent');

	/**
	 * If this item has a significant storage, this can be set to the id of the storage module, allowing easier access to it from the wardrobe.
	 */
	storageModule?: string;

	/**
	 * Info related to crediting assets to their creators.
	 */
	credits: AssetCreditsInfo;
}

export interface BodypartAssetDefinition<A extends AssetDefinitionExtraArgs = AssetDefinitionExtraArgs> extends AssetProperties<A>, AssetBaseDefinition<'bodypart', A> {
	/**
	 * If this asset can be used when randomly picking part needed to fit
	 * @default false
	 */
	allowRandomizerUsage?: boolean;

	/** Extra pose presets available when this bodypart is in use */
	posePresets?: AssetsPosePreset<A['bones']>[];

	/**
	 * Chat specific settings for this asset
	 *
	 * @see https://github.com/Project-Pandora-Game/pandora/blob/master/pandora-common/src/chat/chatActions.ts
	 */
	chat?: {
		/** How items of this asset are referred to in chat (defaults to asset's name) */
		chatDescriptor?: string;
	};

	/** What bodypart this is. */
	bodypart: A['bodyparts'];

	/** Configuration of user-configurable asset colorization */
	colorization?: Record<string, AssetColorization<A>>;

	/** Which colorization group should be used for item's ribbon in inventory (if not specified defaults to first color group) */
	colorRibbonGroup?: string;

	/**
	 * Modules this asset has
	 */
	modules?: Record<string, AssetModuleDefinition<AssetProperties<A>, undefined>>;

	/**
	 * Advanced feature that allows applying additional properties when _all_ state flags of an option are satisfied.
	 * This allows creating more complex "AND" or "OR" condition chains for the asset.
	 */
	stateFlagCombinations?: AssetStateFlagCombination<AssetProperties<A>>[];
}

export interface PersonalAssetRoomDeploymentDefinition {
	/** How should the item be positioned relative to the character that just created/dropped it.
	 * Increasing the first coordinate moves it right (in room view), decreasing left.
	 * Second coordinate moves it back (or to the front when negative).
	 * Third coordinate moves it up or down and should generally be `0` (floor level).
	 *
	 * Note that the x and y offset will be inverted if the character is currently facing backwards.
	 * @example [-100, -1, 0] // When dropped, position it roughly under the character's right hand, in front of the character, on the floor
	 */
	autoDeployRelativePosition: RoomPosition;
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
	 * The default for if this asset requires free hands to be used
	 * @default false
	 */
	requireFreeHandsToUseDefault?: boolean;

	/** Extra pose presets available when inside this device */
	posePresets?: AssetsPosePreset<A['bones']>[];

	/**
	 * Chat specific settings for this asset
	 *
	 * @see https://github.com/Project-Pandora-Game/pandora/blob/master/pandora-common/src/chat/chatActions.ts
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

	/** Configuration of user-configurable asset colorization */
	colorization?: Record<string, AssetColorization<A>>;

	/** Which colorization group should be used for item's ribbon in inventory (if not specified defaults to first color group) */
	colorRibbonGroup?: string;

	/** When set, this item can be deployed and positioned to be visible in a room, if placed in the room inventory. */
	roomDeployment?: PersonalAssetRoomDeploymentDefinition;

	/**
	 * Modules this asset has
	 */
	modules?: Record<string, AssetModuleDefinition<AssetProperties<A>, undefined>>;

	/**
	 * Advanced feature that allows applying additional properties when _all_ state flags of an option are satisfied.
	 * This allows creating more complex "AND" or "OR" condition chains for the asset.
	 */
	stateFlagCombinations?: AssetStateFlagCombination<AssetProperties<A>>[];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type RoomDeviceSlot<A extends AssetDefinitionExtraArgs = AssetDefinitionExtraArgs> = {
	/** Visible name of this slot */
	name: string;
	wearableAsset: AssetId;
};

export interface RoomDeviceModuleStaticData {
	/**
	 * The name of the room device slot to bind character permission
	 * When a character occupies this slot permission checks will be performed against the character
	 */
	slotName: string | null;
}

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
	modules?: Record<string, AssetModuleDefinition<RoomDeviceProperties<A>, RoomDeviceModuleStaticData>>;
	/**
	 * Advanced feature that allows applying additional properties when _all_ state flags of an option are satisfied.
	 * This allows creating more complex "AND" or "OR" condition chains for the asset.
	 */
	stateFlagCombinations?: AssetStateFlagCombination<RoomDeviceProperties<A>>[];
	/** Attributes that are used strictly for filtering, no effect on character */
	staticAttributes?: (A['attributes'])[];
	/**
	 * The default for if this asset requires free hands to be used
	 * @default false
	 */
	requireFreeHandsToUseDefault?: boolean;
	/** Extra pose presets available when inside this device */
	posePresets?: AssetsPosePreset<A['bones']>[];
	/**
	 * Chat specific settings for this asset
	 *
	 * @see https://github.com/Project-Pandora-Game/pandora/blob/master/pandora-common/src/chat/chatActions.ts
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

export interface RoomDeviceWearablePartAssetDefinition<A extends AssetDefinitionExtraArgs = AssetDefinitionExtraArgs> extends RoomDeviceSlotProperties<A>, AssetBaseDefinition<'roomDeviceWearablePart', A> {
	/** Extra pose presets available when wearing this asset, extends device's pose presets */
	posePresets?: AssetsPosePreset<A['bones']>[];
	/**
	 * Chat specific settings for this asset
	 *
	 * @see https://github.com/Project-Pandora-Game/pandora/blob/master/pandora-common/src/chat/chatActions.ts
	 */
	chat?: {
		/** How items of this asset are referred to in chat (defaults to asset's name) */
		chatDescriptor?: string;
	};
}

export interface LockAssetDefinition<A extends AssetDefinitionExtraArgs = AssetDefinitionExtraArgs> extends AssetBaseDefinition<'lock', A> {
	/** Setup for how this particular lock behaves */
	lockSetup: LockSetup;
	/**
	 * Chat specific settings for this asset
	 *
	 * @see https://github.com/Project-Pandora-Game/pandora/blob/master/pandora-common/src/chat/chatActions.ts
	 */
	chat?: {
		/** How items of this asset are referred to in chat (defaults to asset's name) */
		chatDescriptor?: string;
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
}

export type AssetDefinitionTypeMap<A extends AssetDefinitionExtraArgs = AssetDefinitionExtraArgs> =
	Satisfies<
		{
			bodypart: BodypartAssetDefinition<A>;
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

export type AssetAttributeDefinition<A extends AssetDefinitionExtraArgs = AssetDefinitionExtraArgs> = {
	name: string;
	description: string;
	icon?: string;
	useAsWardrobeFilter?: {
		tabs: ('worn' | 'body' | 'room' | 'storage' | 'lockSlot')[];
		excludeAttributes?: readonly A['attributes'][];
	};
	/** Set to false to prevent this attribute from being used to specify asset preferences/permissions/blocks */
	useAsAssetPreference?: false;
};

/** Data for randomly generating sensible appearance */
export type AppearanceRandomizationData<A extends AssetDefinitionExtraArgs = AssetDefinitionExtraArgs> = {
	/** List of attributes for generating body */
	body: readonly A['attributes'][];
	/** List of attributes for generating clothing */
	clothes: readonly A['attributes'][];
	/**
	 * The pose into which will character be reset during randomization.
	 * We do this mainly to avoid bunch of T-Pose characters running around.
	 */
	pose: PartialAppearancePose<A['bones']>;
};

export type RoomBackgroundInfo = RoomBackgroundData & {
	/** The unique identifier for this background */
	id: string;
	/** The visible name for this background */
	name: string;
	/** The preview image for this background */
	preview: string;
	/** The tags that apply to this background */
	tags: string[];
};

export interface RoomBackgroundTagDefinition {
	name: string;
	category: string;
}

export type AssetsTileTextureInfo = {
	/** The unique identifier for this texture */
	id: string;
	/** The visible name for this texture */
	name: string;
	/** File with the texture */
	image: string;
};

export type CharacterModifierInbuiltTemplates = {
	[Type in CharacterModifierType]?: (Extract<CharacterModifierSpecificTemplate, { type: Type; }>)[];
};

export interface AssetsDefinitionFile {
	assets: Record<AssetId, AssetDefinition>;
	bones: Record<string, BoneDefinitionCompressed>;
	posePresets: AssetsPosePresets;
	bodyparts: AssetBodyPart[];
	/**
	 * "ID" hash of a file containing runtime graphics definitions.
	 *
	 * The file can be found relative to assets source, at path `./graphics_${graphicsId}.json`
	 * @see GraphicsDefinitionFile
	 */
	graphicsId: string;
	/**
	 * "ID" hash of a file containing source graphics definitions, mainly for use in the editor.
	 *
	 * The file can be found relative to assets source, at path `./graphicsSource_${graphicsId}.json`
	 * @see GraphicsSourceDefinitionFile
	 */
	graphicsSourceId: string;
	backgroundTags: Record<string, RoomBackgroundTagDefinition>;
	backgrounds: RoomBackgroundInfo[];
	/** Tiles usable for custom backgrounds. Each describes a texture that can be used. */
	tileTextures: AssetsTileTextureInfo[];
	attributes: Record<string, AssetAttributeDefinition>;
	randomization: AppearanceRandomizationData;
	characterModifierTemplates: CharacterModifierInbuiltTemplates;
}
