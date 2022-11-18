import { z } from 'zod';
import type { IChatroomBackgroundData } from '../chatroom';
import { HexColorString, zTemplateString } from '../validation';
import type { ArmsPose, BoneName } from './appearance';
import type { BoneDefinitionCompressed } from './graphics';
import { AssetModuleDefinition } from './modules';
import { AssetProperties } from './properties';

export type AssetTypeDefinition = 'clothing' | 'restraint';
export type AssetSlotDefinition =
	'frontHair' |
	'backHair' |
	'eyes' |
	'nose' |
	'mouth' |
	'head' |
	'neck' |
	'top' |
	'bottom' |
	'torso' |
	'arms' |
	'hands' |
	'legs' |
	'feet';

export const AssetIdSchema = zTemplateString<`a/${string}`>(z.string(), /^a\//);
export type AssetId = z.infer<typeof AssetIdSchema>;

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

	/** Chat action messages specific to this asset */
	actionMessages?: {
		/** Message for when this item is added */
		itemAdd?: string;
		/** Message for when this item is removed */
		itemRemove?: string;
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

	/** Is this rather a body part, clothing or a restraint */
	kind?: AssetTypeDefinition;

	/** list of all body parts, this item uses */
	occupies?: AssetSlotDefinition[] | AssetSlotDefinition;

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
