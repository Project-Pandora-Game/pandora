import { BoneDefinition, LayerDefinition, BoneDefinitionCompressed, LayerImageOverride, LayerMirror, LayerSide } from 'pandora-common/dist/character/asset/definition';
import type { BoneState, AssetDefinition } from '../def';
import { GraphicsCharacter } from '../graphicsCharacter';
import { AssetStoreBase, MirrorCondition, MirrorPoint } from './assetStoreBase';

export class AssetStore extends AssetStoreBase<BoneDefinition, BoneState, LayerDefinition, AssetDefinition> {

	protected constructor() {
		super();
	}

	//#region Assets & Layers

	protected createLayer(data: LayerDefinition): [LayerDefinition] | [LayerDefinition, LayerDefinition] {
		if (data.mirror === LayerMirror.NONE)
			return [data];

		const mirrored = {
			...data,
			imageOverrides: data.imageOverrides.map(({ image, condition }): LayerImageOverride => ({ image, condition: MirrorCondition(condition) })),
		};

		if (data.mirror === LayerMirror.FULL) {
			mirrored.x = GraphicsCharacter.WIDTH - data.x;
			mirrored.points = data.points.map(MirrorPoint);
		} else {
			data.side = LayerSide.LEFT;
			mirrored.side = LayerSide.RIGHT;
		}

		return [data, mirrored];
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
