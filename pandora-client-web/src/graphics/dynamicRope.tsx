import { CoordinatesCompressed } from 'pandora-common';
import { PixiComponent } from '@pixi/react';
import { Mesh, MeshGeometry, MeshMaterial, Texture, WRAP_MODES } from 'pixi.js';

type DynamicRopeConfigProps = {
	start: CoordinatesCompressed;
	end: CoordinatesCompressed;
	pointsPerLength: number;
	length: number;
	include?: (pos: CoordinatesCompressed, start: CoordinatesCompressed, end: CoordinatesCompressed, secondHalf: boolean) => boolean;
};

type DynamicRopeGeometryProps = {
	width: number;
	textureScale?: number;
} & DynamicRopeConfigProps;

type DynamicRopeMeshProps = {
	texture: Texture;
} & DynamicRopeGeometryProps;

export type DynamicRopeProps = {
	tint?: number;
	alpha?: number;
} & DynamicRopeMeshProps;

class DynamicRopeGeometry extends MeshGeometry {
	private _points: CoordinatesCompressed[] = [];

	public props: DynamicRopeConfigProps;
	public textureScale: number;
	public width: number;

	constructor({ width, textureScale, ...props }: DynamicRopeGeometryProps) {
		const numPoints = props.pointsPerLength * props.length;
		super(
			new Float32Array(numPoints * 4),
			new Float32Array(numPoints * 4),
			new Uint16Array((numPoints - 1) * 6),
		);
		this.props = props;
		this.width = width;
		this.textureScale = textureScale ?? 0;

		this._calculatePoints();
		this._build();
	}

	public recalculate(): void {
		this._calculatePoints();
		this._build();
	}

	private _calculatePoints(): void {
		const { start, end, pointsPerLength, length, include } = this.props;

		const points: CoordinatesCompressed[] = [];
		const [startX, startY] = start;
		const [endX, endY] = end;

		const deltaX = endX - startX;
		const deltaY = endY - startY;
		const numPoints = pointsPerLength * length;

		const sag = Math.sqrt(length * length - deltaX * deltaX - deltaY * deltaY) / 2;

		for (let i = 0; i < numPoints; i++) {
			const t = i / numPoints;
			const u = 1 - t;
			const uu = u * u;
			const tt = t * t;
			const ut2 = 2 * u * t;

			// Quadratic Bezier Curve with sag
			const x = (uu * startX) + (ut2 * (startX + (deltaX / 2))) + (tt * endX);
			const y = (uu * startY) + (ut2 * (startY + (deltaY / 2 + sag))) + (tt * endY);

			if (include == null || include([x, y], start, end, i >= numPoints / 2))
				points.push([x, y]);
		}

		this._points = points;
	}

	private _build(): void {
		const points = this._points;

		const vertexBuffer = this.getBuffer('aVertexPosition');
		const uvBuffer = this.getBuffer('aTextureCoord');
		const indexBuffer = this.getIndex();

		// if the number of points has changed we will need to recreate the arraybuffers
		if (vertexBuffer.data.length / 4 !== points.length) {
			vertexBuffer.data = new Float32Array(points.length * 4);
			uvBuffer.data = new Float32Array(points.length * 4);
			indexBuffer.data = new Uint16Array((points.length - 1) * 6);
		}

		const uvs = uvBuffer.data;
		const indices = indexBuffer.data;

		uvs[0] = 0;
		uvs[1] = 0;
		uvs[2] = 0;
		uvs[3] = 1;

		let amount = 0;
		let prev = points[0];
		const textureWidth = this.width * this.textureScale;
		const total = points.length; // - 1;

		for (let i = 0; i < total; i++) {
			// time to do some smart drawing!
			const index = i * 4;

			if (this.textureScale > 0) {
				// calculate pixel distance from previous point
				const dx = prev[0] - points[i][0];
				const dy = prev[1] - points[i][1];
				const distance = Math.sqrt((dx * dx) + (dy * dy));

				prev = points[i];
				amount += distance / textureWidth;
			} else {
				// stretch texture
				amount = i / (total - 1);
			}

			uvs[index] = amount;
			uvs[index + 1] = 0;

			uvs[index + 2] = amount;
			uvs[index + 3] = 1;
		}

		let indexCount = 0;

		for (let i = 0; i < total - 1; i++) {
			const index = i * 2;

			indices[indexCount++] = index;
			indices[indexCount++] = index + 1;
			indices[indexCount++] = index + 2;

			indices[indexCount++] = index + 2;
			indices[indexCount++] = index + 1;
			indices[indexCount++] = index + 3;
		}

		// ensure that the changes are uploaded
		uvBuffer.update();
		indexBuffer.update();

		this._updateVertices();
	}

	/** refreshes vertices of Rope mesh */
	private _updateVertices(): void {
		const points = this._points;

		let lastPoint = points[0];
		let nextPoint;
		let perpX = 0;
		let perpY = 0;

		const vertices = this.buffers[0].data;
		const total = points.length;
		const halfWidth = this.textureScale > 0 ? this.textureScale * this.width / 2 : this.width / 2;

		for (let i = 0; i < total; i++) {
			const point = points[i];
			const index = i * 4;

			if (i < points.length - 1) {
				nextPoint = points[i + 1];
			} else {
				nextPoint = point;
			}

			perpY = -(nextPoint[0] - lastPoint[0]);
			perpX = nextPoint[1] - lastPoint[1];

			let ratio = (1 - (i / (total - 1))) * 10;

			if (ratio > 1) {
				ratio = 1;
			}

			const perpLength = Math.sqrt((perpX * perpX) + (perpY * perpY));

			if (perpLength < 1e-6) {
				perpX = 0;
				perpY = 0;
			} else {
				perpX /= perpLength;
				perpY /= perpLength;

				perpX *= halfWidth;
				perpY *= halfWidth;
			}

			vertices[index] = point[0] + perpX;
			vertices[index + 1] = point[1] + perpY;
			vertices[index + 2] = point[0] - perpX;
			vertices[index + 3] = point[1] - perpY;

			lastPoint = point;
		}

		this.buffers[0].update();
	}
}

class DynamicRopeMesh extends Mesh {
	public readonly ropeGeometry: DynamicRopeGeometry;

	constructor({ texture, ...props }: DynamicRopeMeshProps) {
		const geometry = new DynamicRopeGeometry(props);
		const material = new MeshMaterial(texture);
		if (props.textureScale != null && props.textureScale > 0) {
			// attempt to set UV wrapping, will fail on non-power of two textures
			texture.baseTexture.wrapMode = WRAP_MODES.REPEAT;
		}
		super(geometry, material);
		this.ropeGeometry = geometry;
	}
}

export const DynamicRope = PixiComponent<DynamicRopeProps, DynamicRopeMesh>('DynamicRope', {
	create({ tint, alpha, ...props }) {
		const mesh = new DynamicRopeMesh(props);

		mesh.ropeGeometry.getBuffer('aVertexPosition').static = false;

		mesh.tint = tint ?? 0xffffff;
		mesh.alpha = alpha ?? 1;

		return mesh;
	},
	applyProps(mesh, oldProps, newProps) {
		const {
			tint: oldTint,
			alpha: oldAlpha,
			texture: oldTexture,
			start: oldStart,
			end: oldEnd,
			include: oldInclude,
			pointsPerLength: oldPointsPerLength,
			length: oldLength,
			width: oldWidth,
			textureScale: oldTextureScale,
		} = oldProps;
		const {
			tint,
			alpha,
			texture,
			start,
			end,
			include,
			pointsPerLength,
			length,
			width,
			textureScale,
		} = newProps;

		let ret = false;
		let recalculate = false;

		if (start !== oldStart
			|| end !== oldEnd
			|| include !== oldInclude
			|| pointsPerLength !== oldPointsPerLength
			|| length !== oldLength
			|| width !== oldWidth
			|| textureScale !== oldTextureScale
		) {
			mesh.ropeGeometry.props.start = start;
			mesh.ropeGeometry.props.end = end;
			mesh.ropeGeometry.props.length = length;
			mesh.ropeGeometry.props.pointsPerLength = pointsPerLength;
			mesh.ropeGeometry.props.include = include;
			mesh.ropeGeometry.width = width;
			mesh.ropeGeometry.textureScale = textureScale ?? 0;
			recalculate = true;
		}

		if (texture !== oldTexture) {
			mesh.material.texture = texture;
			ret = true;
		}

		if (tint !== oldTint) {
			mesh.tint = tint ?? 0xffffff;
			ret = true;
		}

		if (alpha !== oldAlpha) {
			mesh.alpha = alpha ?? 1;
			ret = true;
		}

		if (recalculate) {
			mesh.ropeGeometry.recalculate();
			return true;
		}

		return ret;
	},
	config: {
		destroy: true,
		destroyChildren: false,
	},
});
