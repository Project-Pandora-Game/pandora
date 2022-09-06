import { z } from 'zod';
import { HexColorString, zTemplateString } from '../validation';
import type { ArmsPose, BoneName } from './appearance';
import type { EffectsProperty } from './effects';
import type { BoneDefinitionCompressed } from './graphics';

export const AssetIdSchema = zTemplateString<`a/${string}`>(z.string(), /^a\//);
export type AssetId = z.infer<typeof AssetIdSchema>;

export interface AssetDefinitionPoseLimits<Bones extends BoneName = BoneName> {
	/**
	 * Forces the bones within specific range; has two options at representation:
	 * - `[number, number]` - Minimum and maximum for this bone
	 * - `number` - Must be exactly this; shorthand for min=max
	 */
	forcePose?: Partial<Record<Bones, [number, number] | number>>;
	forceArms?: ArmsPose;
}

export interface AssetDefinition<Bones extends BoneName = BoneName> {
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
	bodypart?: string;
	/** Configuration of user-configurable asset colorization */
	colorization?: {
		/** Name that describes the meaning of this color to user, `null` if it cannot be colored by user */
		name: string | null;
		default: HexColorString;
	}[];
	/** Configuration of how the asset limits pose */
	poseLimits?: AssetDefinitionPoseLimits<Bones>;
	/** The effects this item applies when worn */
	effects?: EffectsProperty;
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

export interface AssetsDefinitionFile {
	assets: Record<AssetId, AssetDefinition>;
	bones: Record<string, BoneDefinitionCompressed>;
	posePresets: AssetsPosePresets;
	bodyparts: AssetBodyPart[];
	graphicsId: string;
}
