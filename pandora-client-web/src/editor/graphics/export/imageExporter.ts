import { Size, Rectangle, CharacterSize } from 'pandora-common/dist/assets';
import { Application, Container, Texture, Mesh, MeshGeometry, RenderTexture, Matrix } from 'pixi.js';
import Delaunator from 'delaunator';
import { DataString, AssertDataString } from '../../../common/downloadHelper';
import { PromiseOnce } from 'pandora-common';

type ImageFormat = 'png' | 'jpg' | 'webp';

export class ImageExporter {
	private readonly _getApp: () => Promise<Application>;

	constructor() {
		this._getApp = PromiseOnce(async () => {
			const app = new Application();
			await app.init({
				backgroundAlpha: 0,
				resolution: 1,
				antialias: true,
			});
			return app;
		});
	}

	public async export(target: Container, format: ImageFormat): Promise<DataString> {
		const app = await this._getApp();

		app.renderer.resize(target.width, target.height);
		const child = app.stage.addChild(target);
		const result = await app.renderer.extract.base64({ target, format });
		app.stage.removeChild(child);
		AssertDataString(result);
		return result;
	}

	public async textureCut(texture: Texture, size: Size, points: [number, number][], format: ImageFormat): Promise<DataString> {
		const cutter = new TextureCutter(texture, size, points);
		return await this.export(cutter, format);
	}

	public async imageCut(container: Container, rect: Rectangle, format: ImageFormat, resultSize: Readonly<Size> = { width: CharacterSize.WIDTH, height: CharacterSize.HEIGHT }): Promise<DataString> {
		const app = await this._getApp();

		const renderTexture = RenderTexture.create(resultSize);
		WithCullingDisabled(container, () => {
			app.renderer.render({
				container,
				target: renderTexture,
				transform: Matrix.IDENTITY
					.translate(-rect.x, -rect.y)
					.scale(resultSize.width / rect.width, resultSize.height / rect.height),
			});
		});
		const result = await app.renderer.extract.base64({ target: renderTexture, format });
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
		const triangles = new Delaunator(points.flat()).triangles;
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

/**
 * TODO: Remove this function when pixi.js fixes the bug or if we find a better way to do this.
 */
function WithCullingDisabled(object: unknown, action: () => void) {
	const visited = new Set<Container>();
	const restore: Mesh[] = [];
	const disableCulling = (target: unknown) => {
		if (target instanceof Container) {
			if (visited.has(target as Container)) {
				return;
			}
			visited.add(target as Container);
			if (target instanceof Mesh) {
				if (target.state.culling) {
					restore.push(target as Mesh);
					target.state.culling = false;
				}
			}
			target.children?.forEach(disableCulling);
		}
	};
	disableCulling(object);
	try {
		action();
	} finally {
		restore.forEach((mesh) => {
			mesh.state.culling = true;
		});
	}
}
