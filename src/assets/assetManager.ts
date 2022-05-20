import { Asset, AssetManager, AssetsDefinitionFile, GetLogger, BoneDefinitionCompressed, BoneDefinition, AssetDefinition, AssetDefinitionCompressed, AssetId, LayerDefinition, LayerDefinitionCompressed, PointDefinition, ConditionCompressed, Condition, LayerMirror, LayerImageOverride, LayerSide, TransformDefinition, PointDefinitionCompressed, TransformDefinitionCompressed, CharacterSize } from 'pandora-common';
import { Observable } from '../observable';

const logger = GetLogger('AssetManager');

export interface BoneDefinitionClient extends BoneDefinition {
	x: number;
	y: number;
	parent?: BoneDefinitionClient;
	mirror?: BoneDefinitionClient;
}

export interface AssetDefinitionClient extends AssetDefinition {
	layers: LayerDefinition[];
}

export class AssetManagerClient extends AssetManager {
	public readonly assetList = new Observable<Asset[]>([]);

	override load(definitionsHash: string, data: AssetsDefinitionFile): void {
		super.load(definitionsHash, data);
		this.assetList.value = this.getAllAssets();
	}

	public override loadAssets(assets: Record<AssetId, AssetDefinitionCompressed>): void {
		this._loadPoints(assets);
		super.loadAssets(assets);
	}

	protected override createAsset(id: AssetId, { name, layers }: AssetDefinitionCompressed): AssetDefinitionClient {
		return {
			id,
			name,
			layers: layers.flatMap((layer, idx) => this.createLayer(this._uncompressLayer(layer, id, idx))),
		};
	}

	protected createLayer(layer: LayerDefinition): [LayerDefinition] | [LayerDefinition, LayerDefinition] {
		if (layer.mirror === LayerMirror.NONE)
			return [layer];

		const mirrored = {
			...layer,
			imageOverrides: layer.imageOverrides.map(({ image, condition }): LayerImageOverride => ({ image, condition: MirrorCondition(condition) })),
		};

		if (layer.mirror === LayerMirror.FULL) {
			mirrored.x = CharacterSize.WIDTH - layer.x;
			mirrored.points = layer.points.map(MirrorPoint);
		} else {
			layer.side = LayerSide.LEFT;
			mirrored.side = LayerSide.RIGHT;
		}

		return [layer, mirrored];
	}

	protected override createBone(name: string, bone: BoneDefinitionCompressed, parent?: BoneDefinitionClient, mirror?: BoneDefinitionClient): BoneDefinitionClient {
		const [x, y] = bone.pos ?? [0, 0];
		const res = {
			x, y,
			name,
			mirror,
			parent,
		};
		if (mirror) {
			mirror.mirror = res;
		}
		return res;
	}

	//#region PointDefinition lookup

	private readonly _points = new Map<string, PointDefinition[] | string>();

	private _getPointsKey(assetId: AssetId, layerId: number): string {
		return `${assetId}#${layerId}`;
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

	private _loadPoints(assets: Record<AssetId, AssetDefinitionCompressed>) {
		this._points.clear();

		const all = [...Object.entries(assets)].flatMap(([id, asset]) => asset.layers
			.map((layer) => {
				if (typeof layer.points === 'string' && !layer.points.includes('#'))
					layer.points = `${id}#${layer.points}`;

				return layer;
			})
			.map((layer, idx) => ({
				assetId: id as AssetId,
				key: this._getPointsKey(id as AssetId, idx),
				points: layer.points,
			})));

		all
			.filter((item) => Array.isArray(item.points))
			.forEach((item) => this._points.set(item.key, this._uncompressPoints(item.points)));
		let next = all
			.filter((item) => typeof item.points === 'string') as { assetId: AssetId; key: string; points: string; }[];

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

	//#endregion PointDefinition lookup

	//#region uncompress

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

	//#endregion uncompress

	protected mirrorPoint(point: PointDefinition): [PointDefinition] | [PointDefinition, PointDefinition] {
		if (!point.mirror)
			return [point];

		const { pos, transforms, pointType } = point;
		const type = pointType && (pos[0] < CharacterSize.WIDTH / 2 ? `${pointType}_r` : `${pointType}_l`);

		return [{ ...point, mirror: false, pointType: type }, {
			pos: [CharacterSize.WIDTH - pos[0], pos[1]],
			transforms: transforms.map((trans) => MirrorTransform(trans)),
			mirror: true,
			pointType: MirrorPointType(type),
		}];
	}
}

let assetManager: AssetManagerClient | undefined;

export function GetAssetManager(): AssetManagerClient {
	return assetManager ??= new AssetManagerClient();
}

export function OverrideAssetManager(manager: AssetManagerClient) {
	assetManager = manager;
}

export function LoadAssetDefinitions(definitionsHash: string, data: AssetsDefinitionFile): void {
	GetAssetManager().load(definitionsHash, data);
	logger.info(`Loaded asset definitions, version: ${GetAssetManager().definitionsHash}`);
}

export function MirrorBone(bone: string): string {
	if (bone.endsWith('_l'))
		return bone.replace(/_l$/, '_r');
	if (bone.endsWith('_r'))
		return bone.replace(/_r$/, '_l');

	return bone;
}

/** formatting for `<T extends (...)>` is different for ESLint and VS Code */
type Maybe<T> = T | undefined;
export function MirrorCondition<T extends Maybe<Condition>>(condition: T): T {
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
