import type { Immutable } from 'immer';
import {
	Assert,
	AssertNever,
	DualQuaternion,
	MAX_BONE_COUNT,
	Vector2,
	type AssetManager,
	type AtomicPoseCondition,
	type CharacterPoseTransforms,
	type PointDefinitionCalculated,
} from 'pandora-common';

export type LayerVerticesResult = {
	vertices: Float32Array;
};

export type LayerVerticesTransformData = {
	vertices: Float32Array;
	vertexSkinningBoneIndices: Uint16Array;
	vertexSkinningBoneWeights: Float32Array;
	boneTransforms: Float32Array;
};

type Points = Immutable<PointDefinitionCalculated[]>;
type Dependencies = {
	bones: string[];
	shifts: { bone: string; conditionIndex?: number; }[];
	conditions: Immutable<AtomicPoseCondition[]>[];
};
type CachedVertices = {
	inputs: number[];
	result: LayerVerticesResult;
};
type PointSetCache = {
	dependencies: Dependencies;
	pretransformDependencies: Dependencies;
	// A small working set permits reuse across poses/characters without retaining animation history.
	vertices: CachedVertices[];
	pretransformedVertices: CachedVertices[];
	skinning?: {
		vertexSkinningBoneIndices: Uint16Array;
		vertexSkinningBoneWeights: Float32Array;
	};
};
type BoneLayout = {
	bones: string[];
	indices: ReadonlyMap<string, number>;
	points: WeakMap<Points, PointSetCache>;
};

type PointResult = { x: number; y: number; };
type PointResults = { transformed?: PointResult; skinned?: PointResult; };
const evaluatedPoints = new WeakMap<CharacterPoseTransforms, WeakMap<Immutable<PointDefinitionCalculated>, PointResults>>();

const MAX_CACHED_POSES = 4;
const boneLayouts = new WeakMap<AssetManager, BoneLayout>();
const bonePalettes = new WeakMap<CharacterPoseTransforms, Float32Array>();
const transformedVertices = new WeakMap<CharacterPoseTransforms, WeakMap<Points, LayerVerticesResult>>();
const transformData = new WeakMap<CharacterPoseTransforms, WeakMap<Points, LayerVerticesTransformData>>();

function GetBoneLayout(assetManager: AssetManager): BoneLayout {
	let layout = boneLayouts.get(assetManager);
	if (layout === undefined) {
		const bones = ['', ...assetManager.getAllBones().map((b) => b.name)];
		layout = { bones, indices: new Map(bones.map((bone, index) => [bone, index])), points: new WeakMap() };
		boneLayouts.set(assetManager, layout);
	}
	return layout;
}

function GetPointSetCache(evaluator: CharacterPoseTransforms, points: Points): PointSetCache {
	const layout = GetBoneLayout(evaluator.assetManager);
	let cache = layout.points.get(points);
	if (cache === undefined) {
		const shifts = new Map<string, { bone: string; conditionIndex?: number; }>();
		const skinningBones = new Set<string>();
		const conditions = new Map<string, Immutable<AtomicPoseCondition[]>>();
		for (const point of points) {
			for (const transform of point.transforms) {
				let conditionIndex: number | undefined;
				if (transform.condition?.length) {
					const key = JSON.stringify(transform.condition);
					if (!conditions.has(key))
						conditions.set(key, transform.condition);
					conditionIndex = [...conditions.keys()].indexOf(key);
				}
				switch (transform.type) {
					case 'shift':
						shifts.set(JSON.stringify([transform.bone, conditionIndex]), { bone: transform.bone, conditionIndex });
						break;
					case 'const-shift':
						break;
					default:
						AssertNever(transform);
				}
			}
			for (const entry of point.skinning ?? []) {
				if (entry.weight === 0)
					continue;
				let bone = evaluator.assetManager.getBoneByName(entry.bone);
				while (true) {
					skinningBones.add(bone.name);
					if (bone.parent == null)
						break;
					bone = bone.parent;
				}
			}
		}
		const conditionList = [...conditions.values()];
		cache = {
			dependencies: { bones: [...skinningBones], shifts: [...shifts.values()], conditions: conditionList },
			pretransformDependencies: { bones: [], shifts: [...shifts.values()], conditions: conditionList },
			vertices: [],
			pretransformedVertices: [],
		};
		layout.points.set(points, cache);
	}
	return cache;
}

function EvalVertices(evaluator: CharacterPoseTransforms, points: Points, skinning: boolean): LayerVerticesResult {
	const cache = GetPointSetCache(evaluator, points);
	const dependencies = skinning ? cache.dependencies : cache.pretransformDependencies;
	const entries = skinning ? cache.vertices : cache.pretransformedVertices;
	const conditionResults = dependencies.conditions.map((condition) => condition.every((c) => evaluator.evalCondition(c)));
	const inputs = dependencies.bones.map((bone) => evaluator.getBoneLikeValue(bone));
	for (const shift of dependencies.shifts) {
		inputs.push(shift.conditionIndex === undefined || conditionResults[shift.conditionIndex] ? evaluator.getBoneLikeValue(shift.bone) : 0);
	}
	for (const enabled of conditionResults) {
		inputs.push(enabled ? 1 : 0);
	}
	const index = entries.findIndex((entry) => entry.inputs.every((value, i) => Object.is(value, inputs[i])));
	if (index >= 0) {
		const [entry] = entries.splice(index, 1);
		entries.unshift(entry);
		return entry.result;
	}

	const vertices = new Float32Array(2 * points.length);
	const tmpVec = new Vector2();
	let pointCache = evaluatedPoints.get(evaluator);
	if (pointCache === undefined) {
		pointCache = new WeakMap();
		evaluatedPoints.set(evaluator, pointCache);
	}
	for (let i = 0; i < points.length; i++) {
		const point = points[i];
		const applySkinning = skinning && point.skinning !== undefined;
		let cached = pointCache.get(point);
		let value = applySkinning ? cached?.skinned : cached?.transformed;
		if (value === undefined) {
			tmpVec.set(point.pos[0], point.pos[1]);
			if (applySkinning) {
				evaluator.skinPoint(tmpVec, point.skinning, point.transforms);
			} else {
				evaluator.evalTransformVec(tmpVec, point.transforms);
			}
			value = { x: tmpVec.x, y: tmpVec.y };
			if (cached === undefined) {
				cached = {};
				pointCache.set(point, cached);
			}
			if (applySkinning)
				cached.skinned = value;
			else
				cached.transformed = value;
		}
		vertices[2 * i] = value.x;
		vertices[2 * i + 1] = value.y;
	}

	// Changed inputs can still leave geometry unchanged (e.g. a disabled conditional shift).
	// Preserve its identity so callers need not upload/re-rasterize identical positions.
	const equivalent = entries.find((entry) => entry.result.vertices.every((value, i) => Object.is(value, vertices[i])));
	const result = equivalent?.result ?? { vertices };
	entries.unshift({ inputs, result });
	if (entries.length > MAX_CACHED_POSES)
		entries.pop();
	return result;
}

export function EvalLayerVerticesTransform(evaluator: CharacterPoseTransforms, points: Points): LayerVerticesResult {
	let cache = transformedVertices.get(evaluator);
	if (cache === undefined) {
		cache = new WeakMap();
		transformedVertices.set(evaluator, cache);
	}
	let result = cache.get(points);
	if (result === undefined) {
		result = EvalVertices(evaluator, points, true);
		cache.set(points, result);
	}
	return result;
}

/** All mesh layers of a pose share the same immutable GPU bone palette. */
function GetBonePalette(evaluator: CharacterPoseTransforms): Float32Array {
	let palette = bonePalettes.get(evaluator);
	if (palette === undefined) {
		palette = new Float32Array(8 * MAX_BONE_COUNT);
		const bones = GetBoneLayout(evaluator.assetManager).bones;
		Assert(bones.length <= MAX_BONE_COUNT);
		const tmpQuat = new DualQuaternion();
		for (let i = 0; i < bones.length; i++) {
			evaluator.getBoneTransformQuaterion(tmpQuat, bones[i] || null);
			tmpQuat.toArray(palette, 8 * i);
		}
		bonePalettes.set(evaluator, palette);
	}
	return palette;
}

export function EvalLayerVerticesTransformData(evaluator: CharacterPoseTransforms, points: Points): LayerVerticesTransformData {
	let cache = transformData.get(evaluator);
	if (cache === undefined) {
		cache = new WeakMap();
		transformData.set(evaluator, cache);
	}
	let result = cache.get(points);
	if (result === undefined) {
		const pointSet = GetPointSetCache(evaluator, points);
		if (pointSet.skinning === undefined) {
			const indices = new Uint16Array(4 * points.length);
			const weights = new Float32Array(4 * points.length);
			const boneIndices = GetBoneLayout(evaluator.assetManager).indices;
			for (let i = 0; i < points.length; i++) {
				const skinning = points[i].skinning;
				Assert(skinning === undefined || skinning.length <= 4);
				for (let si = 0; si < (skinning?.length ?? 0); si++) {
					const entry = skinning![si];
					const index = boneIndices.get(entry.bone);
					Assert(index !== undefined);
					indices[4 * i + si] = index;
					weights[4 * i + si] = entry.weight;
				}
			}
			pointSet.skinning = { vertexSkinningBoneIndices: indices, vertexSkinningBoneWeights: weights };
		}
		result = {
			vertices: EvalVertices(evaluator, points, false).vertices,
			...pointSet.skinning,
			boneTransforms: GetBonePalette(evaluator),
		};
		cache.set(points, result);
	}
	return result;
}
