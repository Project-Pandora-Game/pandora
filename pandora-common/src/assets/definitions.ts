import { z } from 'zod';
import { HexColorString, zTemplateString } from '../validation';
import { BoneDefinitionCompressed } from './graphics';

export const AssetIdSchema = zTemplateString<`a/${string}`>(z.string(), /^a\//);
export type AssetId = z.infer<typeof AssetIdSchema>;

export interface AssetDefinition {
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

export interface AssetsDefinitionFile {
	assets: Record<AssetId, AssetDefinition>;
	bones: Record<string, BoneDefinitionCompressed>;
	bodyparts: AssetBodyPart[];
	graphicsId: string;
}
