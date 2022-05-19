import { CreateStringValidator } from '../validation';
import { LayerDefinitionCompressed, BoneDefinitionCompressed } from './graphics';

export type AssetId = `a/${string}`;

/** Test if a given value is a valid AssetId - `'a/{string}'` */
export const IsAssetId = CreateStringValidator<AssetId>({
	regex: /^a\//,
});

export interface AssetDefinitionCompressed {
	name: string;
	layers: LayerDefinitionCompressed[];
}

export interface AssetDefinition {
	id: AssetId;
	name: string;
}

export interface AssetsDefinitionFile {
	assets: Record<AssetId, AssetDefinitionCompressed>;
	bones: Record<string, BoneDefinitionCompressed>;
}
