import { CreateStringValidator } from '../validation';
import { BoneDefinitionCompressed } from './graphics';

export type AssetId = `a/${string}`;

/** Test if a given value is a valid AssetId - `'a/{string}'` */
export const IsAssetId = CreateStringValidator<AssetId>({
	regex: /^a\//,
});

export interface AssetDefinition {
	id: AssetId;
	name: string;
	bodypart?: string;
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
