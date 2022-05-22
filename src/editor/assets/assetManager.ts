import { Asset, AssetDefinition, AssetDefinitionCompressed, AssetId, BoneDefinitionCompressed, LayerDefinition, PointDefinition } from 'pandora-common';
import { AssetManagerClient, OverrideAssetManager, GetAssetManager as GetAssetManagerClient, BoneDefinitionClient, AssetDefinitionClient } from '../../assets/assetManager';
import { observable, ObservableClass } from '../../observable';
import { MirrorPointDefinition } from '../graphics/editorStore';
import { ObservableBone, ObservableLayer } from '../graphics/observable';

export class AssetManagerEditor extends AssetManagerClient {

	public readonly assetTreeView: AssetTreeView = new AssetTreeViewClass;

	override getAllBones(): ObservableBone[] {
		return super.getAllBones() as ObservableBone[];
	}

	public override loadAssets(assets: Record<AssetId, AssetDefinitionCompressed>): void {
		super.loadAssets(assets);
		this.assetTreeView.update(this.getAllAssets());
	}

	protected override createAsset(id: AssetId, data: AssetDefinitionCompressed): AssetDefinitionClient {
		return new AssetDefinitionEditor(super.createAsset(id, data));
	}

	protected override createLayer(data: LayerDefinition): [LayerDefinition] | [LayerDefinition, LayerDefinition] {
		const layer = new ObservableLayer(data);
		if (!data.mirror)
			return [layer];

		return [layer, layer.getMirrored()];
	}

	protected override mirrorPoint(def: PointDefinition): [PointDefinition] | [PointDefinition, PointDefinition] {
		const point = new MirrorPointDefinition({ ...def, mirror: false });
		if (def.mirror)
			return [point, point.createPair()];

		return [point];
	}

	protected override createBone(name: string, bone: BoneDefinitionCompressed, parent?: BoneDefinitionClient, mirror?: BoneDefinitionClient): BoneDefinitionClient {
		return new ObservableBone(name, bone, parent as ObservableBone, mirror as ObservableBone);
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

export class AssetDefinitionEditor extends ObservableClass<{ open: boolean; }> implements AssetDefinition {

	@observable
	public open: boolean = true;

	public id: AssetId;
	public name: string;
	public layers: ObservableLayer[];

	constructor(def: AssetDefinitionClient) {
		super();
		this.id = def.id;
		this.name = def.name;
		this.layers = def.layers as ObservableLayer[];
	}
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
			categoryTreeView.set(name, asset.definition as AssetDefinitionEditor);
		}
	}
}

export type AssetTreeViewCategory = AssetTreeViewCategoryClass;
class AssetTreeViewCategoryClass extends ObservableClass<{ open: boolean; }> {
	private _assets = new Map<string, AssetDefinitionEditor>();

	get assets(): AssetDefinitionEditor[] {
		return [...this._assets.values()];
	}
	readonly name: string;

	@observable
	public open: boolean = true;

	constructor(name: string) {
		super();
		this.name = name;
	}

	set(name: string, asset: AssetDefinitionEditor) {
		this._assets.set(name, asset);
	}
}
