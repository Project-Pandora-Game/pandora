import { BoneDefinitionCompressed, LayerDefinition, PointDefinition } from 'pandora-common';
import { AssetManagerClient, OverrideAssetManager, GetAssetManager as GetAssetManagerClient, BoneDefinitionClient } from '../../assets/assetManager';
import { MirrorPointDefinition } from '../graphics/editorStore';
import { ObservableBone, ObservableLayer } from '../graphics/observable';

export class AssetManagerEditor extends AssetManagerClient {

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
