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

const jest = import.meta.jest;
const canvasProbe = jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
const { Texture } = await import('pixi.js');
const { GraphicsSkinnedMesh, GetSkinnedMeshGlProgram } = await import('../../src/graphics/graphicsSkinnedMesh.ts');
const { GraphicsBonePalette } = await import('../../src/graphics/graphicsBonePalette.ts');
GetSkinnedMeshGlProgram();
canvasProbe.mockRestore();

function MeshData(offset = 0): LayerVerticesTransformData {
	const bones = new Float32Array(8 * MAX_BONE_COUNT);
	new DualQuaternion().fromRotationTranslation(
		Quaternion.fromAxisAngle(new Vector3(0, 0, 1), 0.5), new Vector3(offset, 10, 0),
	).toArray(bones);
	return {
		vertices: new Float32Array([0, 0, 20, 0, 0, 20]),
		vertexSkinningBoneIndices: new Uint16Array(12),
		vertexSkinningBoneWeights: new Float32Array(12),
		boneTransforms: bones,
	};
}

function Render(mesh: InstanceType<typeof GraphicsSkinnedMesh>, count: number): void {
	for (let frame = 0; frame < count; frame++)
		mesh.prepareForRender();
}

describe('settled mesh poses', () => {
	const uvs = new Float32Array([0, 0, 1, 0, 0, 1]);
	const indices = new Uint32Array([0, 1, 2]);

	it('bakes a settled pose once and restores GPU skinning before a changed pose is drawn', () => {
		const data = MeshData();
		const mesh = new GraphicsSkinnedMesh(data, uvs, indices, Texture.WHITE);
		const shader = mesh.shader;
		try {
			Render(mesh, 3);
			expect(mesh.shader).toBe(shader);
			Render(mesh, 5);
			expect(mesh.shader).toBeNull();
			expect(mesh.renderPipeId).toBe('mesh');
			const positions = mesh.geometry.getBuffer('aPosition').data;
			expect(positions).toEqual(SkinMeshPositions(data));
			Render(mesh, 100);
			expect(mesh.geometry.getBuffer('aPosition').data).toBe(positions);
			expect(mesh.containsPoint({ x: (positions[0] + positions[2] + positions[4]) / 3, y: (positions[1] + positions[3] + positions[5]) / 3 })).toBe(true);

			const next = { ...data, boneTransforms: MeshData(30).boneTransforms };
			mesh.update(next, uvs, indices, Texture.WHITE);
			expect(mesh.shader).toBe(shader);
			expect(mesh.geometry.getBuffer('aPosition').data).toBe(next.vertices);
			expect(mesh.renderPipeId).toBe('pandoraSkinnedMesh');
			expect(mesh.bounds.minX).toBeGreaterThan(10);
			Render(mesh, 8);
			expect(mesh.shader).toBeNull();
			expect(mesh.geometry.getBuffer('aPosition').data).toEqual(SkinMeshPositions(next));
		} finally {
			mesh.destroy();
		}
	});

	it('keeps moving poses on the GPU and preserves a settled pose through UV and texture updates', () => {
		let data = MeshData();
		const mesh = new GraphicsSkinnedMesh(data, uvs, indices, Texture.WHITE);
		const shader = mesh.shader;
		const positionUpdates = jest.fn();
		mesh.geometry.getBuffer('aPosition').on('update', positionUpdates);
		try {
			for (let pose = 0; pose < 20; pose++) {
				data = { ...data, boneTransforms: MeshData(pose).boneTransforms };
				mesh.update(data, uvs, indices, Texture.WHITE);
				Render(mesh, 3);
				expect(mesh.shader).toBe(shader);
			}
			expect(positionUpdates).not.toHaveBeenCalled();
			Render(mesh, 8);
			expect(positionUpdates).toHaveBeenCalledTimes(1);
			const positions = mesh.geometry.getBuffer('aPosition').data;
			mesh.update(data, uvs.slice(), indices.slice(), Texture.EMPTY);
			expect(mesh.shader).toBeNull();
			expect(mesh.geometry.getBuffer('aPosition').data).toBe(positions);
			expect(mesh.texture).toBe(Texture.EMPTY);
		} finally {
			mesh.destroy();
		}
	});

	it('invalidates settled positions for geometry and weight changes and releases its idle palette lease', () => {
		const data = MeshData();
		const palette = new GraphicsBonePalette();
		const mesh = new GraphicsSkinnedMesh(data, uvs, indices, Texture.WHITE, undefined, palette);
		try {
			Render(mesh, 8);
			expect(palette.referenceCount).toBe(1);
			const changed = { ...data, vertices: data.vertices.slice(), vertexSkinningBoneWeights: data.vertexSkinningBoneWeights.slice() };
			changed.vertices[0] = 5;
			mesh.update(changed, uvs, indices, Texture.WHITE);
			expect(mesh.shader).not.toBeNull();
			Render(mesh, 8);
			expect(mesh.geometry.getBuffer('aPosition').data).toEqual(SkinMeshPositions(changed));
		} finally {
			mesh.destroy();
		}
		expect(palette.referenceCount).toBe(0);
	});
});
