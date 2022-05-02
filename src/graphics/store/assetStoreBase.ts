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
		this._loadPoints(assets);
		for (const data of assets) {
			const asset = this.createAsset(this._uncompressAsset(data));
			this._assets.set(asset.id, asset);
		}
	}

	protected abstract createLayer(data: LayerDefinition): [LayerDefinitionType] | [LayerDefinitionType, LayerDefinitionType];
	protected abstract createAsset(data: AssetDefinition<LayerDefinitionType>): AssetDefinitionType;

	private readonly _points = new Map<string, PointDefinition[] | string>();

	private _getPointsKey(assetId: AssetId, layerId: number): string {
		return `${assetId}#${layerId}`;
	}

	private _loadPoints(data: AssetDefinitionCompressed[]) {
		const all = data.flatMap((asset) => asset.layers.map((layer, idx) => ({
			assetId: asset.id,
			key: this._getPointsKey(asset.id, idx),
			points: layer.points,
		})));
		all
			.filter((item) => Array.isArray(item.points))
			.forEach((item) => this._points.set(item.key, this._uncompressPoints(item.points)));
		let next = all
			.filter((item) => typeof item.points === 'string') as { assetId: AssetId; key: string; points: string; }[];

		next.forEach((item) => {
			if (!item.points.includes('#')) {
				item.points = `${item.assetId}#${item.points}`;
			}
		});

		while (next.length > 0) {
			const next2 = next.reduce((acc, item) => {
				if (this._points.has(item.points)) {
					this._points.set(item.key, item.points);
				} else {
					acc.push(item);
				}
				return acc;
			}, [] as typeof next);

			if (next2.length === next.length) {
				throw new Error('Circular reference');
			}

			next = next2;
		}
	}

	private _lookupPoints(key: string): PointDefinition[] {
		const points = this._points.get(key);
		if (Array.isArray(points)) {
			return points;
		}
		if (typeof points === 'string') {
			return this._lookupPoints(points);
		}
		throw new Error(`Invalid points key: ${key}`);
	}

	private _uncompressAsset({ id, layers, description }: AssetDefinitionCompressed): AssetDefinition<LayerDefinitionType> {
		return {
			id,
			layers: layers.flatMap((layer, idx) => this.createLayer(this._uncompressLayer(layer, id, idx))),
			description,
		};
	}

	private _uncompressLayer(data: LayerDefinitionCompressed, assetId: AssetId, index: number): LayerDefinition {
		const [x, y, width, height] = data.rect;
		const rect = { x, y, width, height };
		return {
			...rect,
			mirror: data.mirror,
			priority: data.priority,
			points: this._lookupPoints(this._getPointsKey(assetId, index)),
			image: data.image,
			imageOverrides: data.imageOverrides?.map(([image, condition]) => ({ image, condition: this._uncompressCondition(condition) })) ?? [],
			pointType: data.pointType,
		};
	}

	private _uncompressPoints(points: PointDefinitionCompressed[] | string): PointDefinition[] {
		if (typeof points === 'string')
			return []; // TODO

		return points.flatMap((point) => this._uncompressPoint(point));
	}

	private _uncompressPoint({ pos, pointType, transforms = [], mirror }: PointDefinitionCompressed): PointDefinition[] {
		const point = {
			pos,
			transforms: transforms.map((trans) => this._uncompressTransform(trans)),
			mirror: mirror === true,
			pointType,
		};
		return this.mirrorPoint(point);
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
		return mirror ? MirrorTransform(transform) : transform;
	}

	private _uncompressCondition(condition: ConditionCompressed): Condition {
		return condition?.map((segment) => segment.map(([bone, operator, value]) => ({ bone, operator, value })));
	}

	protected mirrorPoint(point: PointDefinition): [PointDefinition] | [PointDefinition, PointDefinition] {
		if (!point.mirror)
			return [point];

		const { pos, transforms, pointType } = point;
		const type = pointType && (pos[0] < GraphicsCharacter.WIDTH / 2 ? `${pointType}_r` : `${pointType}_l`);

		return [{ ...point, mirror: false, pointType: type }, {
			pos: [GraphicsCharacter.WIDTH - pos[0], pos[1]],
			transforms: transforms.map((trans) => MirrorTransform(trans)),
			mirror: true,
			pointType: MirrorPointType(type),
		}];
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
				if (bone.name.endsWith('_l') && !bone.mirror.endsWith('_r'))
					throw new Error(`Mirrored bone ${bone.name} has invalid mirror name ${bone.mirror}, mirror must end with _r`);
				if (bone.name.endsWith('_r') && !bone.mirror.endsWith('_l'))
					throw new Error(`Mirrored bone ${bone.name} has invalid mirror name ${bone.mirror}, mirror must end with _l`);
				if (!bone.name.endsWith('_l') && !bone.name.endsWith('_r'))
					throw new Error(`Mirrored bone ${bone.name} has invalid name, name must end with _l or _r`);

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

	private _bones: Map<string, BoneDefinitionType> = new Map();

	//#endregion Bones

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	protected static _instance?: AssetStoreBase<any, any, any, any>;
}

export function MirrorBone(bone: string): string {
	if (bone.endsWith('_l'))
		return bone.replace(/_l$/, '_r');
	if (bone.endsWith('_r'))
		return bone.replace(/_r$/, '_l');

	return bone;
}

export function MirrorCondition<T extends(Condition | undefined)>(condition: T): T {
	if (!condition)
		return condition;

	return condition.map((cause) => cause.map(({ bone, ...rest }) => ({
		...rest,
		bone: MirrorBone(bone),
	}))) as T;
}

export function MirrorTransform(transform: TransformDefinition): TransformDefinition {
	const { type, bone, condition } = transform;
	const trans = {
		bone: MirrorBone(bone),
		condition: MirrorCondition(condition),
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

export function MirrorPointType(type?: string): string | undefined {
	return type && type.replace(/_r$/, '_l').replace(/_l$/, '_r');
}

export function MirrorPoint(point: PointDefinition): PointDefinition {
	return {
		pos: point.pos,
		mirror: point.mirror,
		transforms: point.transforms.map(MirrorTransform),
		pointType: MirrorPointType(point.pointType),
	};
}
