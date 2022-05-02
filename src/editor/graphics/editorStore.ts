import type { LayerDefinition, BoneDefinitionCompressed, PointDefinition, TransformDefinition } from 'pandora-common/dist/character/asset/definition';
import type { AssetDefinition } from '../../graphics/def';
import { GraphicsCharacter } from '../../graphics/graphicsCharacter';
import { AssetStoreBase, MirrorTransform } from '../../graphics/store';
import { ObservableBone, ObservableLayer } from './observable';

export class EditorAssetStore extends AssetStoreBase<ObservableBone, ObservableBone, ObservableLayer, AssetDefinition<ObservableLayer>> {

	protected constructor() {
		super();
	}

	//#region Assets & Layers

	protected createLayer(data: LayerDefinition): [ObservableLayer] | [ObservableLayer, ObservableLayer] {
		const layer = new ObservableLayer(data);
		if (!data.mirror)
			return [layer];

		return [layer, layer.getMirrored()];
	}

	protected createAsset(data: AssetDefinition<ObservableLayer>): AssetDefinition<ObservableLayer> {
		return data;
	}

	protected override mirrorPoint(def: PointDefinition): [PointDefinition] | [PointDefinition, PointDefinition] {
		const point = new MirrorPointDefinition({ ...def, mirror: false });
		if (def.mirror)
			return [point, point.createPair()];

		return [point];
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

export class MirrorPointDefinition implements PointDefinition {
	private _pair: MirrorPointDefinition | undefined;
	public pos: [number, number];
	public mirror: boolean;
	public transforms: TransformDefinition[];
	public pointType?: string;

	constructor({ pos, mirror, transforms, pointType }: PointDefinition, pair?: MirrorPointDefinition) {
		this._pair = pair;
		this.pos = pos;
		this.mirror = mirror;
		this.transforms = transforms;
		this.pointType = pointType;
		if (pointType && !pointType.endsWith('_l') && !pointType.endsWith('_r')) {
			this.pointType += pos[0] < GraphicsCharacter.WIDTH / 2 ? '_r' : '_l';
		}

		this.updatePair();
	}

	public isMirrored(): boolean {
		return !!this._pair;
	}

	public createPair(): MirrorPointDefinition {
		this._pair ??= new MirrorPointDefinition(this, this);
		return this._pair;
	}

	public removePair(): void {
		if (this._pair) {
			this._pair._pair = undefined;
			this._pair = undefined;
		}
	}

	public updatePair(keys?: (keyof PointDefinition)[]): void {
		if (!this._pair) {
			return;
		}
		const { pos, mirror, transforms, pointType } = this;
		if (!keys || keys.includes('pos')) {
			this._pair.pos = [GraphicsCharacter.WIDTH - pos[0], pos[1]];
		}
		if (!keys || keys.includes('mirror')) {
			this._pair.mirror = !mirror;
		}
		if (!keys || keys.includes('transforms')) {
			this._pair.transforms = transforms.map(MirrorTransform);
		}
		if (!keys || keys.includes('pointType')) {
			this._pair.pointType = pointType && pointType.replace(/_r$/, '_l').replace(/_l$/, '_r');
		}
	}
}
