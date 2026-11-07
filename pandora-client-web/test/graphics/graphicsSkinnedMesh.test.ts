import { DualQuaternion, Matrix4x4, MAX_BONE_COUNT, Quaternion, Vector3, Vector4 } from 'pandora-common';
import { SkinMeshPositions } from '../../src/graphics/graphicsSkinning.ts';
import type { LayerVerticesTransformData } from '../../src/graphics/layers/graphicsLayerVertices.ts';

describe('SkinMeshPositions', () => {
	it.each([0, 0.25, 0.75, 1])('matches the common dual-quaternion transform with bone weight %s', (weight) => {
		const bones = new Float32Array(8 * MAX_BONE_COUNT);
		new DualQuaternion(1, 0, 0, 0, 0, 0, 0, 0).toArray(bones);
		new DualQuaternion().fromRotationTranslation(
			Quaternion.fromAxisAngle(new Vector3(0, 0, 1), 0.9), new Vector3(15, -25, 0),
		).toArray(bones, 8);
		new DualQuaternion().fromRotationTranslation(
			Quaternion.fromAxisAngle(new Vector3(0, 0, 1), -0.5), new Vector3(-10, 5, 0),
		).toArray(bones, 16);
		const data: LayerVerticesTransformData = {
			vertices: new Float32Array([20, 40, -35, 80]),
			vertexSkinningBoneIndices: new Uint16Array([1, 2, 0, 0, 1, 2, 0, 0]),
			vertexSkinningBoneWeights: new Float32Array([weight, (1 - weight) * 0.5, 0, 0, weight, (1 - weight) * 0.5, 0, 0]),
			boneTransforms: bones,
		};
		const actual = SkinMeshPositions(data);
		const readBone = (index: number): DualQuaternion => new DualQuaternion(
			bones[8 * index], bones[8 * index + 1], bones[8 * index + 2], bones[8 * index + 3],
			bones[8 * index + 4], bones[8 * index + 5], bones[8 * index + 6], bones[8 * index + 7],
		);
		const blend = readBone(1).multiplyByScalar(weight)
			.add(readBone(2).multiplyByScalar((1 - weight) * 0.5))
			.add(readBone(0).multiplyByScalar((1 - weight) * 0.5));
		const matrix = new Matrix4x4();
		blend.toTransformationMatrix(matrix);
		for (let vi = 0; vi < data.vertices.length; vi += 2) {
			const expected = new Vector4(data.vertices[vi], data.vertices[vi + 1], 0, 1).multiplyByMatrix4x4(matrix);
			expect(actual[vi]).toBeCloseTo(expected.x, 4);
			expect(actual[vi + 1]).toBeCloseTo(expected.y, 4);
		}
	});

	it('leaves unskinned positions unchanged and does not mutate the input', () => {
		const data: LayerVerticesTransformData = {
			vertices: new Float32Array([10, 30, 50, 70]),
			vertexSkinningBoneIndices: new Uint16Array(8),
			vertexSkinningBoneWeights: new Float32Array(8),
			boneTransforms: new Float32Array(8 * MAX_BONE_COUNT),
		};
		new DualQuaternion(1, 0, 0, 0, 0, 0, 0, 0).toArray(data.boneTransforms);
		const result = SkinMeshPositions(data);
		expect(result).toEqual(data.vertices);
		expect(result).not.toBe(data.vertices);
	});
});
