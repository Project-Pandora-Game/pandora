import type { LayerDefinition, BoneDefinitionCompressed } from 'pandora-common/dist/character/asset/definition';
import type { AssetDefinition } from '../../graphics/def';
import { AssetStoreBase } from '../../graphics/store';
import { ObservableBone, ObservableLayer } from './observable';

export class EditorAssetStore extends AssetStoreBase<ObservableBone, ObservableBone, ObservableLayer, AssetDefinition<ObservableLayer>> {

	protected constructor() {
		super();
	}

	//#region Assets & Layers

	protected createLayer(data: LayerDefinition): ObservableLayer {
		return new ObservableLayer(data);
	}

	protected createAsset(data: AssetDefinition<ObservableLayer>): AssetDefinition<ObservableLayer> {
		return data;
	}

	//#endregion Assets & Layers

	//#region Bones

	protected createBone(bone: BoneDefinitionCompressed, parent?: ObservableBone, mirror?: ObservableBone): ObservableBone {
		return new ObservableBone(bone, parent, mirror);
	}

	protected createBoneState(bone: ObservableBone, context: Map<string, ObservableBone>): ObservableBone {
		context.set(bone.name, bone);
		return bone;
	}

	//#endregion Bones

	public static getInstance(): EditorAssetStore {
		if (!AssetStoreBase._instance || !(AssetStoreBase._instance instanceof EditorAssetStore))
			AssetStoreBase._instance = new EditorAssetStore();

		return AssetStoreBase._instance as EditorAssetStore;
	}
}
