import { BoneDefinitionClient } from '../../assets/assetManager';
import { BoneState } from '../../graphics/def';
import { AssetStateManager, OverrideAssetStateManager, GetAssetStateManager as GetAssetStateManagerClient } from '../../graphics/stateManager';

export class AssetStateManagerEditor extends AssetStateManager {

	protected override createBoneState(bone: BoneDefinitionClient, context: Map<string, BoneState>): BoneState {
		context.set(bone.name, bone as BoneState);
		return bone as BoneState;
	}
}

let loaded = false;

export function GetAssetStateManagerEditor(): AssetStateManagerEditor {
	if (!loaded) {
		OverrideAssetStateManager(new AssetStateManagerEditor());
		loaded = true;
	}
	return GetAssetStateManagerClient() as AssetStateManagerEditor;
}
