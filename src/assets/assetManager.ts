import { Asset } from './asset';
import { AssetId, AssetsDefinitionFile } from './definitions';

export class AssetManager {
	private readonly assets: Map<AssetId, Asset> = new Map();
	private _definitionsHash: string = '';

	get definitionsHash(): string {
		return this._definitionsHash;
	}

	public getAllAssets(): Asset[] {
		return [...this.assets.values()];
	}

	public getAssetById(id: AssetId): Asset | undefined {
		return this.assets.get(id);
	}

	public load(definitionsHash: string, data: AssetsDefinitionFile): void {
		this._definitionsHash = definitionsHash;
		// First unload no-longer existing assets
		for (const id of this.assets.keys()) {
			if (data.assets[id] === undefined) {
				this.assets.delete(id);
			}
		}
		// Then load or update all defined assets
		for (const [id, definition] of Object.entries(data.assets)) {
			if (!id.startsWith('a/')) {
				throw new Error(`Asset without valid prefix: ${id}`);
			}
			let asset = this.assets.get(id as AssetId);
			if (asset) {
				asset.load(definition);
			} else {
				asset = new Asset(id as AssetId, definition);
				this.assets.set(id as AssetId, asset);
			}
		}
	}
}
