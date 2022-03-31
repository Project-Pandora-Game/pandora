import type { BoneDefinition, LayerDefinition, BoneDefinitionCompressed } from 'pandora-common/dist/character/asset/definition';
import type { BoneState, AssetDefinition } from '../def';
import { GraphicsCharacter } from '../graphicsCharacter';
import { AssetStoreBase } from './assetStoreBase';

export class AssetStore extends AssetStoreBase<BoneDefinition, BoneState, LayerDefinition, AssetDefinition> {

	protected constructor() {
		super();
	}

	//#region Assets & Layers

	protected createLayer(data: LayerDefinition): LayerDefinition {
		return data;
	}

	protected createAsset(data: AssetDefinition): AssetDefinition {
		return data;
	}

	//#endregion Assets & Layers

	//#region Bones

	protected createBone(bone: BoneDefinitionCompressed, parent?: BoneDefinition, mirror?: BoneDefinition): BoneDefinition {
		const pos = bone.pos ?? [0, 0];
		const res = {
			name: bone.name,
			x: pos[0],
			y: pos[1],
			mirror,
			parent,
			rotation: bone.rotation ?? 180,
		};
		if (mirror) {
			res.x = GraphicsCharacter.WIDTH - res.x;
			mirror.mirror = res;
		}
		return res;
	}

	protected createBoneState(bone: BoneDefinition, context: Map<string, BoneState>): BoneState {
		let def = context.get(bone.name);
		if (def) {
			return def;
		}
		let rotation = bone.rotation;
		def = {
			name: bone.name,
			x: bone.x,
			y: bone.y,
			get rotation() {
				return rotation;
			},
			updateRotation(value: number): boolean {
				let update = (value + bone.rotation + 360) % 360;
				if (update > 180) update -= 360;
				if (update !== rotation) {
					rotation = update;
					return true;
				}
				return false;
			},
			parent: bone.parent ? this.createBoneState(bone.parent, context) : undefined,
			mirror: bone.mirror ? this.createBoneState(bone.mirror, context) : undefined,
		};
		context.set(bone.name, def);
		return def;
	}

	//#endregion

	public static getInstance(): AssetStore {
		if (!AssetStoreBase._instance)
			AssetStoreBase._instance = new AssetStore();

		return AssetStoreBase._instance as AssetStore;
	}
}
