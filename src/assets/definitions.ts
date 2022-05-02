export type AssetId = `a/${string}`;

export interface AssetDefinition {
	name: string;
}

export interface AssetsDefinitionFile {
	assets: Record<AssetId, AssetDefinition>;
}
