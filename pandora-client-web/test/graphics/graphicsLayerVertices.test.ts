import type { Immutable } from 'immer';
import {
	APPEARANCE_POSE_DEFAULT,
	AssetManager,
	CharacterPoseTransforms,
	Vector2,
	type AppearancePose,
	type PointDefinitionCalculated,
} from 'pandora-common';
import { EvalLayerVerticesTransform, EvalLayerVerticesTransformData } from '../../src/graphics/layers/graphicsLayerVertices.ts';

function Manager(): AssetManager {
	return new AssetManager('vertex-cache-test', {
		bones: {
			root: { pos: [500, 500], type: 'pose' },
			arm_l: { pos: [400, 400], parent: 'root', mirror: 'arm_r', type: 'pose' },
			leg: { pos: [500, 800], parent: 'root', type: 'pose' },
		},
	});
}
function Evaluator(manager: AssetManager, pose: Partial<AppearancePose> = {}): CharacterPoseTransforms {
	return new CharacterPoseTransforms(manager, { ...APPEARANCE_POSE_DEFAULT, ...pose });
}
function Point(overrides: Partial<PointDefinitionCalculated> = {}): PointDefinitionCalculated {
	return { pos: [425, 325], index: 0, pointType: 'test', mirror: false, isMirror: false, transforms: [], ...overrides };
}
function Uncached(evaluator: CharacterPoseTransforms, points: Immutable<PointDefinitionCalculated[]>): Float32Array {
	const vertices = new Float32Array(2 * points.length);
	for (let i = 0; i < points.length; i++) {
		const point = points[i];
		const position = new Vector2(...point.pos);
		if (point.skinning) {
			evaluator.skinPoint(position, point.skinning, point.transforms);
		} else {
			evaluator.evalTransformVec(position, point.transforms);
		}
		vertices[2 * i] = position.x;
		vertices[2 * i + 1] = position.y;
	}
	return vertices;
}

describe('layer geometry caching', () => {
	it('reuses unchanged geometry across unrelated pose changes, without mutating earlier poses', () => {
		const manager = Manager();
		const points = [Point({ skinning: [{ bone: 'leg', weight: 1 }] })];
		const a = EvalLayerVerticesTransform(Evaluator(manager), points);
		const saved = a.vertices.slice();
		const arm = EvalLayerVerticesTransform(Evaluator(manager, { bones: { arm_l: 80 } }), points);
		expect(arm).toBe(a);
		const leg = EvalLayerVerticesTransform(Evaluator(manager, { bones: { leg: 80 } }), points);
		expect(leg).not.toBe(a);
		expect(a.vertices).toEqual(saved);
	});

	it('invalidates for ancestor rotation, mirrored bones and transform-condition outcomes', () => {
		const manager = Manager();
		const points = [Point({
			skinning: [{ bone: 'arm_r', weight: 0.7 }],
			transforms: [{ type: 'shift', bone: 'width', value: { x: 40, y: 15 }, condition: [{ view: 'back' }] }],
		})];
		const poses: Partial<AppearancePose>[] = [
			{}, { bones: { root: 30 } }, { bones: { arm_r: 50 } },
			{ view: 'back', bones: { width: 90 } }, { view: 'front', bones: { width: 90 } },
		];
		for (const pose of poses) {
			const evaluator = Evaluator(manager, pose);
			expect(EvalLayerVerticesTransform(evaluator, points).vertices).toEqual(Uncached(evaluator, points));
		}
	});

	it('tracks arm, leg and numeric conditions but reuses equal condition outcomes', () => {
		const manager = Manager();
		const points = [Point({
			transforms: [
				{ type: 'const-shift', value: { x: 10, y: 0 }, condition: [{ armType: 'rotation', side: 'left', operator: '=', value: 'up' }] },
				{ type: 'const-shift', value: { x: 0, y: 10 }, condition: [{ legs: 'kneeling' }] },
				{ type: 'const-shift', value: { x: -4, y: 0 }, condition: [{ bone: 'root', operator: '>', value: 10 }] },
			],
		})];
		const base = EvalLayerVerticesTransform(Evaluator(manager), points);
		for (const pose of [
			{ leftArm: { ...APPEARANCE_POSE_DEFAULT.leftArm, rotation: 'up' as const } },
			{ legs: { upper: 'left' as const, pose: 'kneeling' as const } },
			{ bones: { root: 20 } },
		]) {
			const evaluator = Evaluator(manager, pose);
			const result = EvalLayerVerticesTransform(evaluator, points);
			expect(result).not.toBe(base);
			expect(result.vertices).toEqual(Uncached(evaluator, points));
		}
		const high = EvalLayerVerticesTransform(Evaluator(manager, { bones: { root: 30 } }), points);
		const higher = EvalLayerVerticesTransform(Evaluator(manager, { bones: { root: 40 } }), points);
		expect(higher).toBe(high);
	});

	it('shares palettes across layers and static skinning buffers across poses', () => {
		const manager = Manager();
		const points = [Point({ skinning: [{ bone: 'arm_l', weight: 0.6 }] })];
		const otherPoints = [Point({ skinning: [{ bone: 'leg', weight: 1 }] })];
		const evaluator = Evaluator(manager);
		const first = EvalLayerVerticesTransformData(evaluator, points);
		const second = EvalLayerVerticesTransformData(evaluator, otherPoints);
		expect(first.boneTransforms).toBe(second.boneTransforms);
		const changed = EvalLayerVerticesTransformData(Evaluator(manager, { bones: { arm_l: 90 } }), points);
		expect(changed.boneTransforms).not.toBe(first.boneTransforms);
		expect(changed.vertices).toBe(first.vertices);
		expect(changed.vertexSkinningBoneIndices).toBe(first.vertexSkinningBoneIndices);
		expect(changed.vertexSkinningBoneWeights).toBe(first.vertexSkinningBoneWeights);
		expect([...first.vertexSkinningBoneIndices]).toEqual([2, 0, 0, 0]);
		expect(first.vertexSkinningBoneWeights[0]).toBeCloseTo(0.6);
	});

	it('keeps asset managers isolated and remains exact after bounded-cache eviction', () => {
		const manager = Manager();
		const points = [Point({ skinning: [{ bone: 'root', weight: 1 }] })];
		const first = EvalLayerVerticesTransform(Evaluator(manager), points);
		for (let angle = 1; angle < 20; angle++) {
			const evaluator = Evaluator(manager, { bones: { root: angle * 7 } });
			expect(EvalLayerVerticesTransform(evaluator, points).vertices).toEqual(Uncached(evaluator, points));
		}
		const recomputed = EvalLayerVerticesTransform(Evaluator(manager), points);
		expect(recomputed).not.toBe(first);
		expect(recomputed.vertices).toEqual(first.vertices);
		expect(EvalLayerVerticesTransform(Evaluator(Manager()), points)).not.toBe(first);
	});

	it('evaluates shared template points once per pose across overlapping layer point sets', () => {
		class CountingEvaluator extends CharacterPoseTransforms {
			public calls = 0;
			public override skinPoint(...args: Parameters<CharacterPoseTransforms['skinPoint']>): void {
				this.calls++;
				super.skinPoint(...args);
			}
		}
		const manager = Manager();
		const points = Array.from({ length: 200 }, (_, index) => Point({
			pos: [index + 10.25, index * 0.37],
			skinning: [{ bone: index < 100 ? 'arm_l' : 'leg', weight: 1 }],
		}));
		const pose = { ...APPEARANCE_POSE_DEFAULT, bones: { arm_l: 60 } };
		const evaluator = new CountingEvaluator(manager, pose);
		EvalLayerVerticesTransform(evaluator, points.slice(0, 150));
		expect(evaluator.calls).toBe(150);
		const overlapping = points.slice(100);
		const result = EvalLayerVerticesTransform(evaluator, overlapping);
		expect(evaluator.calls).toBe(200);
		expect(result.vertices).toEqual(Uncached(Evaluator(manager, pose), overlapping));
		const changed = new CountingEvaluator(manager, { ...pose, bones: { leg: 30 } });
		const next = EvalLayerVerticesTransform(changed, overlapping);
		expect(changed.calls).toBe(100);
		expect(next.vertices).toEqual(Uncached(Evaluator(manager, changed.pose), overlapping));
	});

	it('keeps shared-point arithmetic identical to uncached evaluation with mixed weights and sequential shifts', () => {
		const manager = Manager();
		const points = Array.from({ length: 120 }, (_, index) => Point({
			pos: [index * 9.173 - 212.123, index * 7.217 + 0.23],
			skinning: index % 3 ? [{ bone: 'arm_r', weight: 0.33 }, { bone: 'leg', weight: 0.59 }] : [],
			transforms: [
				{ type: 'const-shift', value: { x: 0.017, y: -0.0003 } },
				{ type: 'shift', bone: 'width', value: { x: 73.073, y: 21.378 }, condition: [{ view: 'back' }] },
				{ type: 'const-shift', value: { x: -0.0157, y: 1.0387 } },
			],
		}));
		for (let frame = 0; frame < 40; frame++) {
			const pose = {
				view: frame % 3 ? 'front' as const : 'back' as const,
				bones: { root: frame * 2 - 40, arm_r: frame * 5 - 120, leg: 90 - frame * 4, width: frame * 3 - 60 },
			};
			expect(EvalLayerVerticesTransform(Evaluator(manager, pose), points).vertices).toEqual(Uncached(Evaluator(manager, pose), points));
		}
	});

});
