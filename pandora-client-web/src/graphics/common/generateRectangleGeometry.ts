import type { Size } from 'pandora-common';

export function GenerateRectangleMeshGeometry(
	transform: (u: number, v: number) => [x: number, y: number],
	subdivision?: number | Size,
): { vertices: Float32Array<ArrayBuffer>; uvs: Float32Array<ArrayBuffer>; indices: Uint32Array<ArrayBuffer>; } {
	const widthCount = typeof subdivision === 'number' ? subdivision : (subdivision?.width ?? 1);
	const heightCount = typeof subdivision === 'number' ? subdivision : (subdivision?.height ?? 1);
	const vertexCount = (widthCount + 1) * (heightCount + 1);

	const vertices = new Float32Array(2 * vertexCount);
	const uvs = new Float32Array(2 * vertexCount);
	const indices = new Uint32Array((2 * 3 * widthCount * heightCount));

	// Generate vertices
	for (let y = 0; y <= heightCount; y++) {
		for (let x = 0; x <= widthCount; x++) {
			const index = 2 * (y * (widthCount + 1) + x);
			const xCoordinate = x / widthCount;
			const yCoordinate = y / widthCount;
			const [remmappedX, remmappedY] = transform(xCoordinate, yCoordinate);
			vertices[index] = remmappedX;
			vertices[index + 1] = remmappedY;
			uvs[index] = xCoordinate;
			uvs[index + 1] = yCoordinate;
		}
	}

	// Generate triangles
	let indicesIndex = 0;
	for (let y = 0; y < heightCount; y++) {
		for (let x = 0; x < widthCount; x++) {
			const vertexA = (y * (widthCount + 1) + x);
			const vertexB = (y * (widthCount + 1) + x + 1);
			const vertexC = ((y + 1) * (widthCount + 1) + x + 1);
			const vertexD = ((y + 1) * (widthCount + 1) + x);

			indices[indicesIndex++] = vertexA;
			indices[indicesIndex++] = vertexB;
			indices[indicesIndex++] = vertexC;
			indices[indicesIndex++] = vertexC;
			indices[indicesIndex++] = vertexD;
			indices[indicesIndex++] = vertexA;
		}
	}

	return {
		vertices,
		uvs,
		indices,
	};
}
