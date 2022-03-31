import type { LayerDefinition, AssetId, AssetDefinitionCompressed, LayerDefinitionCompressed, PointDefinitionCompressed, PointDefinition, TransformDefinitionCompressed, TransformDefinition, ConditionCompressed, Condition, BoneDefinitionCompressed } from 'pandora-common/dist/character/asset/definition';
import type { AssetState, LayerStateCompressed } from 'pandora-common/dist/character/asset/state';
import type { BoneState, AssetDefinition, LayerState, BoneDefinitionBase } from '../def';
import { GraphicsCharacter } from '../graphicsCharacter';

export abstract class AssetStoreBase<BoneDefinitionType extends BoneDefinitionBase, BoneStateType extends BoneState, LayerDefinitionType extends LayerDefinition, AssetDefinitionType extends AssetDefinition<LayerDefinitionType>> {

	//#region Assets & Layers

	public get assets(): AssetDefinitionType[] {
		return [...this._assets.values()];
	}

	public getAsset(id: AssetId): AssetDefinitionType | undefined {
		return this._assets.get(id);
	}

	public getLayers(data: AssetState): LayerState<LayerDefinitionType>[] {
		const { id } = data;
		const asset = this._assets.get(id);
		if (!asset) {
			return [];
		}
		const layers = asset.layers.map((layer, index) => {
			let state: LayerStateCompressed | undefined;
			if (data.layers) {
				if (typeof data.layers[0] === 'number') {
					state = data.layers as LayerStateCompressed;
				} else {
					state = data.layers[index] as LayerStateCompressed;
				}
			}
			return { asset, layer, index, state };
		});
		return layers;
	}

	public loadAssets(assets: AssetDefinitionCompressed[]) {
		for (const data of assets) {
			const asset = this.createAsset(this._uncompressAsset(data));
			this._assets.set(asset.id, asset);
		}
	}

	protected abstract createLayer(data: LayerDefinition): LayerDefinitionType;
	protected abstract createAsset(data: AssetDefinition<LayerDefinitionType>): AssetDefinitionType;

	private _uncompressAsset({ id, layers, description }: AssetDefinitionCompressed): AssetDefinition<LayerDefinitionType> {
		return {
			id,
			layers: layers.map((layer) => this.createLayer(this._uncompressLayer(layer))),
			description,
		};
	}

	private _uncompressLayer(data: LayerDefinitionCompressed): LayerDefinition {
		return {
			...data,
			points: data.points.flatMap(this._uncompressPoint.bind(this)),
			imageOverrides: data.imageOverrides?.map(([image, condition]) => ({ image, condition: this._uncompressCondition(condition) })) ?? [],
		};
	}

	private _uncompressPoint({ pos, transforms = [], mirror }: PointDefinitionCompressed): PointDefinition[] {
		const point = {
			pos,
			transforms: transforms.map((trans) => this._uncompressTransform(trans)),
			mirror: false,
		};
		if (!mirror)
			return [point];

		return [point, {
			pos: [GraphicsCharacter.WIDTH - pos[0], pos[1]],
			transforms: transforms.map((trans) => this._uncompressTransform(trans, true)),
			mirror: true,
		}];
	}

	private _uncompressTransform(trans: TransformDefinitionCompressed, mirror: boolean = false): TransformDefinition {
		const [type, bone, , compressedCond] = trans;
		const condition = compressedCond && this._uncompressCondition(compressedCond);
		let transform: TransformDefinition;
		switch (type) {
			case 'rotate':
				transform = { type, bone, condition, value: trans[2] };
				break;
			case 'shift':
				transform = { type, bone, condition, value: { x: trans[2][0], y: trans[2][1] } };
				break;
		}
		return mirror ? this._mirrorTransform(transform) : transform;
	}

	private _uncompressCondition(condition: ConditionCompressed): Condition {
		return condition?.map((segment) => segment.map(([bone, operator, value]) => ({ bone, operator, value })));
	}

	private _mirrorCondition(condition?: Condition): Condition | undefined {
		condition?.map((cause) => cause.map(({ bone, ...rest }) => ({
			...rest,
			bone: this._mirrorBone(bone),
		})));
		return condition;
	}

	private _mirrorTransform(transform: TransformDefinition): TransformDefinition {
		const { type, bone, condition } = transform;
		const trans = {
			bone: this._mirrorBone(bone),
			condition: this._mirrorCondition(condition),
		};
		switch (type) {
			case 'rotate': {
				const rotate = transform.value;
				return { ...trans, type, value: rotate * -1 };
			}
			case 'shift': {
				const { x, y } = transform.value;
				return { ...trans, type, value: { x: x * -1, y: y * -1 } };
			}
		}
	}

	private readonly _assets: Map<AssetId, AssetDefinitionType> = new Map();

	//#endregion Assets & Layers

	//#region Bones

	public getInitialBoneStates(): BoneStateType[] {
		const context: Map<string, BoneStateType> = new Map();
		for (const [, bone] of this._bones) {
			this.createBoneState(bone, context);
		}
		return [...context.values()];
	}

	public loadBones(bones: BoneDefinitionCompressed[]) {
		const next: BoneDefinitionCompressed[] = [];
		for (const bone of bones) {
			const parent = bone.parent ? this._bones.get(bone.parent) : undefined;
			if (bone.parent && !parent) {
				next.push(bone);
				continue;
			}
			const newBone = this.createBone(bone, parent);
			this._bones.set(bone.name, newBone);
			if (bone.mirror) {
				this._bones.set(bone.mirror, this.createBone({
					...bone,
					name: bone.mirror,
				}, parent, newBone));
			}
		}
		if (next.length > 0) {
			if (next.length === bones.length)
				throw new Error('Circular dependency detected');

			this.loadBones(next);
		}
	}

	protected getBone(name: string): BoneDefinitionType {
		const bone = this._bones.get(name);
		if (!bone) {
			throw new Error(`Bone '${name}' not found`);
		}
		return bone;
	}

	protected abstract createBone(bone: BoneDefinitionCompressed, parent?: BoneDefinitionType, mirror?: BoneDefinitionType): BoneDefinitionType;
	protected abstract createBoneState(bone: BoneDefinitionType, context: Map<string, BoneStateType>): BoneStateType;

	private _mirrorBone(bone: string): string {
		const { mirror, name } = this.getBone(bone);
		return mirror?.name ?? name;
	}

	private _bones: Map<string, BoneDefinitionType> = new Map();

	//#endregion Bones

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	protected static _instance?: AssetStoreBase<any, any, any, any>;
}
