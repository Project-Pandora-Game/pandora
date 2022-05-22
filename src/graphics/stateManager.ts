import { Asset, AssetState, BoneDefinition } from 'pandora-common';
import { AssetDefinitionClient, BoneDefinitionClient, GetAssetManager } from '../assets/assetManager';
import { BoneState, LayerState } from './def';
import { GetLayerState } from './graphicsLayer';

export class AssetStateManager {

	public getLayers(data: AssetState): LayerState[] {
		const { id } = data;
		const asset = GetAssetManager().getAssetById(id);
		if (!asset) {
			return [];
		}
		const definition = AssetGetClientDefinition(asset);
		const layers = definition.layers.map((layer, index) => ({
			asset: definition,
			state: GetLayerState(data.layers, index),
			layer, index,
		}));
		return layers;
	}

	public getInitialBoneStates(): BoneState[] {
		const context: Map<string, BoneState> = new Map();
		for (const bone of GetAssetManager().getAllBones()) {
			this.createBoneState(GetBoneDefinitionClient(bone), context);
		}
		return [...context.values()];
	}

	protected createBoneState(bone: BoneDefinitionClient, context: Map<string, BoneState>): BoneState {
		let def = context.get(bone.name);
		if (def) {
			return def;
		}
		def = {
			name: bone.name,
			x: bone.x,
			y: bone.y,
			rotation: 0,
			parent: bone.parent ? this.createBoneState(bone.parent, context) : undefined,
			mirror: bone.mirror ? this.createBoneState(bone.mirror, context) : undefined,
		};
		context.set(bone.name, def);
		return def;
	}
}

let assetStateManager: AssetStateManager | undefined;

export function GetAssetStateManager(): AssetStateManager {
	return assetStateManager ??= new AssetStateManager();
}

export function OverrideAssetStateManager(manager: AssetStateManager) {
	assetStateManager = manager;
}

function AssetGetClientDefinition(asset: Asset): AssetDefinitionClient {
	return asset.definition as AssetDefinitionClient;
}

function GetBoneDefinitionClient(bone: BoneDefinition): BoneDefinitionClient {
	return bone as BoneDefinitionClient;
}
