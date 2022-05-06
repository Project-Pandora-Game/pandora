import { CreateStringValidator } from '../validation';

export type AssetId = `a/${string}`;

/** Test if a given value is a valid AssetId - `'a/{string}'` */
export const IsAssetId = CreateStringValidator<AssetId>({
	regex: /^a\//,
});

export interface AssetDefinition {
	name: string;
}

export interface AssetsDefinitionFile {
	assets: Record<AssetId, AssetDefinition>;
}
