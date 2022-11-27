import { z } from 'zod';
import type { IChatroomBackgroundData } from '../chatroom';
import { HexColorString, zTemplateString } from '../validation';
import type { ArmsPose, BoneName } from './appearance';
import type { BoneDefinitionCompressed } from './graphics';
import { AssetModuleDefinition } from './modules';
import { AssetProperties } from './properties';

export const AssetIdSchema = zTemplateString<`a/${string}`>(z.string(), /^a\//);
export type AssetId = z.infer<typeof AssetIdSchema>;

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
}

export interface AssetDefinitionPoseLimits<A extends AssetDefinitionExtraArgs = AssetDefinitionExtraArgs> {
	/**
	 * Forces the bones within specific range; has two options at representation:
	 * - `[number, number]` - Minimum and maximum for this bone
	 * - `number` - Must be exactly this; shorthand for min=max
	 */
	forcePose?: Partial<Record<A['bones'], [number, number] | number>>;
	forceArms?: ArmsPose;
}

export interface AssetDefinition<A extends AssetDefinitionExtraArgs = AssetDefinitionExtraArgs> extends AssetProperties<A> {
	id: AssetId;

	/** The visible name of this asset */
	name: string;

	/**
	 * If this asset can be worn on body directly.
	 * @default true
	 */
	wearable?: boolean;

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
	 * Chat specific settings for this asset
	 *
	 * @see https://github.com/Project-Pandora-Game/pandora/blob/master/pandora-common/src/chatroom/chatActions.ts
	 */
	chat?: {
		/** How items of this asset are referred to in chat (defaults to asset's name) */
		chatDescriptor?: string;
		/** Message for when this item is added (defaults to `itemAdd`) */
		actionAdd?: string;
		/** Message for when this item is removed (defaults to `itemRemove`) */
		actionRemove?: string;
		/** Message for when this item is attached to something (defaults to `itemAttach`) */
		actionAttach?: string;
		/** Message for when this item is removed (defaults to `itemDetach`) */
		actionDetach?: string;
	};

	/** If this asset is a bodypart, `undefined` if not. */
	bodypart?: A['bodyparts'];

	/** Configuration of user-configurable asset colorization */
	colorization?: {
		/** Name that describes the meaning of this color to user, `null` if it cannot be colored by user */
		name: string | null;
		default: HexColorString;
	}[];

	/**
	 * Modules this asset has
	 */
	modules?: Record<string, AssetModuleDefinition<A>>;

	/** If this item has any graphics to be loaded or is only virtual */
	hasGraphics: boolean;
}

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

export type AssetsPosePresets<Bones extends BoneName = BoneName> = {
	category: string;
	poses: {
		name: string;
		pose: Partial<Record<Bones, number>>;
		armsPose?: ArmsPose;
	}[];
}[];

export type IChatroomBackgroundInfo = IChatroomBackgroundData & {
	/** The unique identifier for this background */
	id: string;
	/** The visible name for this background */
	name: string;
};

export interface AssetsDefinitionFile {
	assets: Record<AssetId, AssetDefinition>;
	bones: Record<string, BoneDefinitionCompressed>;
	posePresets: AssetsPosePresets;
	bodyparts: AssetBodyPart[];
	graphicsId: string;
	backgrounds: IChatroomBackgroundInfo[];
}
