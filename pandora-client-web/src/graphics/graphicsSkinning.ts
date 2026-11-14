import type { LayerVerticesTransformData } from './layers/graphicsLayerVertices.ts';

/** Used lazily for accurate bounds and hit testing; normal rendering keeps deformation on the GPU. */
export function SkinMeshPositions(data: LayerVerticesTransformData): Float32Array {
	const { vertices, vertexSkinningBoneIndices: indices, vertexSkinningBoneWeights: weights, boneTransforms: bones } = data;
	const result = new Float32Array(vertices.length);
	const q = new Float64Array(8);
	for (let vi = 0; vi < vertices.length / 2; vi++) {
		q.fill(0);
		let remaining = 1;
		for (let si = 0; si < 4; si++) {
			const index = indices[4 * vi + si];
			const weight = weights[4 * vi + si];
			if (index === 0 || weight === 0) continue;
			for (let qi = 0; qi < 8; qi++) q[qi] += weight * bones[8 * index + qi];
			remaining -= weight;
		}
		for (let qi = 0; qi < 8; qi++) q[qi] += remaining * bones[qi];
		const inverseLength = 1 / Math.hypot(q[0], q[1], q[2], q[3]);
		const rw = q[0] * inverseLength;
		const rx = q[1] * inverseLength;
		const ry = q[2] * inverseLength;
		const rz = q[3] * inverseLength;
		const dw = q[4] * inverseLength;
		const dx = q[5] * inverseLength;
		const dy = q[6] * inverseLength;
		const dz = q[7] * inverseLength;
		const x = vertices[2 * vi];
		const y = vertices[2 * vi + 1];
		result[2 * vi] = (1 - 2 * ry * ry - 2 * rz * rz) * x + (2 * rx * ry - 2 * rw * rz) * y + 2 * (-dw * rx + dx * rw - dy * rz + dz * ry);
		result[2 * vi + 1] = (2 * rx * ry + 2 * rw * rz) * x + (1 - 2 * rx * rx - 2 * rz * rz) * y + 2 * (-dw * ry + dx * rz + dy * rw - dz * rx);
	}
	return result;
}
