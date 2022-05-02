import type { Size, Rectangle } from 'pandora-common/dist/character/asset/definition';
import { Application, Container, Extract, Texture, Mesh, MeshGeometry, MeshMaterial } from 'pixi.js';
import Delaunator from 'delaunator';
import { GraphicsCharacter } from '../../../graphics/graphicsCharacter';

type ImageFormat = 'png' | 'jpg' | 'webp';

export class ImageExorter {
	private readonly _app: Application;

	private get _extract(): Extract {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
		return this._app.renderer.plugins.extract;
	}

	constructor() {
		this._app = new Application({
			backgroundAlpha: 0,
			resolution: 1,
			antialias: true,
		});
	}

	export(target: Container, format: ImageFormat): string {
		this._app.renderer.resize(target.width, target.height);
		const child = this._app.stage.addChild(target);
		const result = this._extract.base64(target, `image/${format}`);
		this._app.stage.removeChild(child);
		return result;
	}

	textureCut(texture: Texture, size: Size, points: [number, number][], format: ImageFormat): string {
		const cutter = new TextureCutter(texture, size, points);
		return this.export(cutter, format);
	}

	characterCut(character: GraphicsCharacter, rect: Rectangle, format: ImageFormat): string {
		this._app.renderer.resize(rect.width, rect.height);
		const child = this._app.stage.addChild(character);
		child.x = -rect.x;
		child.y = -rect.y;
		const result = this._extract.base64(child, `image/${format}`);
		this._app.stage.removeChild(child);
		return result;
	}
}

class TextureCutter extends Container {
	constructor(texture: Texture, { width, height }: Size, points: [number, number][]) {
		super();
		const vertices = new Float64Array(points.flat());
		const uv = new Float64Array(points.flatMap((point) => ([
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

		this.width = width;
		this.height = height;

		mesh.x = points.reduce((x, point) => Math.min(x, point[0]), Infinity) * -1;
		mesh.y = points.reduce((y, point) => Math.min(y, point[1]), Infinity) * -1;
		this.width = points.reduce((w, point) => Math.max(w, point[0]), 0) - this.x;
		this.height = points.reduce((h, point) => Math.max(h, point[1]), 0) - this.y;
	}
}
