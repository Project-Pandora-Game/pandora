import { CalculatePointsTrianglesRaw, CharacterSize, Rectangle, Size } from 'pandora-common';
import { Application, Container, Matrix, Mesh, MeshGeometry, RenderTexture, Texture } from 'pixi.js';
import { AssertDataString, DataString } from '../../../common/downloadHelper.ts';

type ImageFormat = 'png' | 'jpg' | 'webp';

export class ImageExporter {
	public readonly app: Application;

	constructor(app: Application) {
		this.app = app;
	}

	public async export(target: Container, format: ImageFormat): Promise<DataString> {
		this.app.renderer.resize(target.width, target.height);
		const child = this.app.stage.addChild(target);
		const result = await this.app.renderer.extract.base64({ target, format });
		this.app.stage.removeChild(child);
		AssertDataString(result);
		return result;
	}

	public async textureCut(texture: Texture, size: Size, points: [number, number][], format: ImageFormat): Promise<DataString> {
		const cutter = new TextureCutter(texture, size, points);
		return await this.export(cutter, format);
	}

	public async imageCut(container: Container, rect: Rectangle, format: ImageFormat, resultSize: Readonly<Size> = { width: CharacterSize.WIDTH, height: CharacterSize.HEIGHT }): Promise<DataString> {
		const renderTexture = RenderTexture.create({
			...resultSize,
			resolution: 1,
			antialias: true,
		});
		const transform = new Matrix()
			.translate(-rect.x, -rect.y)
			.scale(resultSize.width / rect.width, resultSize.height / rect.height);
		this.app.renderer.render({
			container,
			target: renderTexture,
			transform,
			clearColor: [0, 0, 0, 0],
		});
		renderTexture.source.updateMipmaps();
		const result = await this.app.renderer.extract.base64({ target: renderTexture, format });
		renderTexture.destroy(true);
		AssertDataString(result);
		return result;
	}
}

class TextureCutter extends Container {
	constructor(texture: Texture, { width, height }: Size, points: [number, number][]) {
		super();
		const vertices = new Float32Array(points.flat());
		const uv = new Float32Array(points.flatMap((point) => ([
			point[0] / width,
			point[1] / height,
		])));
		const triangles = CalculatePointsTrianglesRaw(points);
		const geometry = new MeshGeometry({
			positions: vertices,
			uvs: uv,
			indices: triangles,
		});
		const mesh = new Mesh({ geometry, texture });
		this.addChild(mesh);

		mesh.x = points.reduce((x, point) => Math.min(x, point[0]), Infinity) * -1;
		mesh.y = points.reduce((y, point) => Math.min(y, point[1]), Infinity) * -1;
		this.width = points.reduce((w, point) => Math.max(w, point[0]), 0) - this.x;
		this.height = points.reduce((h, point) => Math.max(h, point[1]), 0) - this.y;
	}
}
