import { Size, Rectangle, CharacterSize } from 'pandora-common/dist/assets';
import { Application, Container, IExtract, Texture, Mesh, MeshGeometry, MeshMaterial, RenderTexture, IRenderableObject, DisplayObject, Shader, Matrix } from 'pixi.js';
import Delaunator from 'delaunator';
import { DataString, AssertDataString } from '../../../common/downloadHelper';

type ImageFormat = 'png' | 'jpg' | 'webp';

export class ImageExporter {
	private readonly _app: Application;

	private get _extract(): IExtract {
		return this._app.renderer.extract;
	}

	constructor() {
		this._app = new Application({
			backgroundAlpha: 0,
			resolution: 1,
			antialias: true,
		});
	}

	public async export(target: Container, format: ImageFormat): Promise<DataString> {
		this._app.renderer.resize(target.width, target.height);
		const child = this._app.stage.addChild(target);
		const result = await this._extract.base64(target, `image/${format}`);
		this._app.stage.removeChild(child);
		AssertDataString(result);
		return result;
	}

	public async textureCut(texture: Texture, size: Size, points: [number, number][], format: ImageFormat): Promise<DataString> {
		const cutter = new TextureCutter(texture, size, points);
		return await this.export(cutter, format);
	}

	public async imageCut(object: IRenderableObject, rect: Rectangle, format: ImageFormat, resultSize: Readonly<Size> = { width: CharacterSize.WIDTH, height: CharacterSize.HEIGHT }): Promise<DataString> {
		const renderTexture = RenderTexture.create(resultSize);
		WithCullingDisabled(object, () => {
			this._app.renderer.render(object, {
				renderTexture,
				transform: Matrix.IDENTITY
					.translate(-rect.x, -rect.y)
					.scale(resultSize.width / rect.width, resultSize.height / rect.height),
			});
		});
		const result = await this._extract.base64(renderTexture, `image/${format}`);
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
		const geometry = new MeshGeometry(
			vertices,
			uv,
			triangles,
		);
		const mesh = new Mesh(geometry, new MeshMaterial(texture));
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
	const visited = new Set<DisplayObject>();
	const restore: Mesh<Shader>[] = [];
	const disableCulling = (target: unknown) => {
		if (target instanceof DisplayObject) {
			if (visited.has(target)) {
				return;
			}
			visited.add(target);
			if (target instanceof Mesh) {
				if (target.state.culling) {
					restore.push(target as Mesh<Shader>);
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
