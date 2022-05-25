import { Asset, AssetsDefinitionFile } from 'pandora-common';
import { AssetManagerClient, OverrideAssetManager, GetAssetManager as GetAssetManagerClient } from '../../assets/assetManager';
import { observable, ObservableClass } from '../../observable';

export class AssetManagerEditor extends AssetManagerClient {

	public readonly assetTreeView: AssetTreeView = new AssetTreeViewClass;

	override load(definitionsHash: string, data: AssetsDefinitionFile): void {
		super.load(definitionsHash, data);
		this.assetTreeView.update(this.getAllAssets());
	}
}

let loaded = false;

export function GetAssetManagerEditor(): AssetManagerEditor {
	if (!loaded) {
		OverrideAssetManager(new AssetManagerEditor());
		loaded = true;
	}
	return GetAssetManagerClient() as AssetManagerEditor;
}

export type AssetTreeView = AssetTreeViewClass;
class AssetTreeViewClass {
	private readonly _categories = new Map<string, AssetTreeViewCategory>();

	get categories(): AssetTreeViewCategory[] {
		return [...this._categories.values()];
	}

	update(assets: Asset[]) {
		this._categories.clear();
		for (const asset of assets) {
			const [, category, name] = /^a\/([^/]+)\/([^/]+)$/.exec(asset.id) || [];
			if (!category || !name)
				continue;

			let categoryTreeView = this._categories.get(category);
			if (!categoryTreeView) {
				this._categories.set(category, categoryTreeView = new AssetTreeViewCategoryClass(category));
			}
			categoryTreeView.set(name, asset);
		}
	}
}

export type AssetTreeViewCategory = AssetTreeViewCategoryClass;
class AssetTreeViewCategoryClass extends ObservableClass<{ open: boolean; }> {
	private _assets = new Map<string, Asset>();

	get assets(): Asset[] {
		return [...this._assets.values()];
	}
	readonly name: string;

	@observable
	public open: boolean = true;

	constructor(name: string) {
		super();
		this.name = name;
	}

	set(name: string, asset: Asset) {
		this._assets.set(name, asset);
	}
}
