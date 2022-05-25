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
	hasGraphics: boolean;
}

export interface AssetsDefinitionFile {
	assets: Record<AssetId, AssetDefinition>;
	bones: Record<string, BoneDefinitionCompressed>;
	graphicsId: string;
}
