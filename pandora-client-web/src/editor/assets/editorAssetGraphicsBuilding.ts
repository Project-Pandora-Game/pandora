import { freeze, type Immutable } from 'immer';
import { Assert, AssertNotNullable, EMPTY_ARRAY, LoadAssetLayer, type Asset, type AssetGraphicsDefinition, type GraphicsBuildContext, type GraphicsBuildImageResource, type GraphicsLayer, type ImageBoundingBox, type Logger } from 'pandora-common';
import { Application, Rectangle, Sprite, Texture } from 'pixi.js';
import { GraphicsManagerInstance } from '../../assets/graphicsManager.ts';
import { ArrayToBase64 } from '../../crypto/helpers.ts';
import { CreatePixiApplication } from '../../graphics/graphicsAppManager.ts';
import type { EditorAssetGraphics } from './editorAssetGraphics.ts';
import type { EditorAssetGraphicsLayer } from './editorAssetGraphicsLayer.ts';
import { EditorAssetGraphicsManager } from './editorAssetGraphicsManager.ts';

/** Map to editor asset graphics source layer. Only used in editor. */
export const AssetGraphicsSourceMap = new WeakMap<Immutable<GraphicsLayer>, EditorAssetGraphicsLayer>();

let BuildingPixiApplication: Application | null = null;
let BuildingPixiApplicationPromise: Promise<Application> | null = null;

const TextureBoundingBoxCache = new WeakMap<Texture, ImageBoundingBox>();

class EditorImageResource implements GraphicsBuildImageResource {
	public readonly resultName: string;
	private readonly texture: Texture;
	private readonly buildTextures: Map<string, Texture> | undefined;

	constructor(name: string, texture: Texture, buildTextures?: Map<string, Texture>) {
		this.resultName = name;
		this.texture = texture;
		this.buildTextures = buildTextures;

		buildTextures?.set(name, texture);
	}

	public addCutImageRelative(left: number, top: number, right: number, bottom: number): GraphicsBuildImageResource {
		Assert(left >= 0);
		Assert(top >= 0);
		Assert(right <= 1);
		Assert(bottom <= 1);
		Assert(left < right);
		Assert(top < bottom);

		const suffix = `_${Math.round(100 * left)}` +
			`_${Math.round(100 * top)}` +
			`_${Math.round(100 * right)}` +
			`_${Math.round(100 * bottom)}`;

		const resultLeft = this.texture.frame.left + Math.floor(this.texture.frame.width * left);
		const resultTop = this.texture.frame.top + Math.floor(this.texture.frame.height * top);
		const resultWidth = Math.ceil(this.texture.frame.width * right) - resultLeft;
		const resultHeight = Math.ceil(this.texture.frame.height * bottom) - resultTop;

		const newTexture = new Texture({
			source: this.texture.source,
			frame: new Rectangle(resultLeft, resultTop, resultWidth, resultHeight),
		});

		return new EditorImageResource(this.resultName + suffix, newTexture, this.buildTextures);
	}
	public addResizedImage(_maxWidth: number, _maxHeight: number, _suffix: string): GraphicsBuildImageResource {
		throw new Error('Transform addResizedImage is not supported in the editor.');
	}
	public addDownscaledImage(_resolution: number): GraphicsBuildImageResource {
		throw new Error('Transform addDownscaledImage is not supported in the editor.');
	}
	public addSizeCheck(_exactWidth: number, _exactHeight: number): void {
		// NOOP
	}
	public async getContentBoundingBox(): Promise<ImageBoundingBox> {
		const cachedResult = TextureBoundingBoxCache.get(this.texture);
		if (cachedResult !== undefined)
			return cachedResult;

		if (BuildingPixiApplicationPromise == null) {
			BuildingPixiApplicationPromise = CreatePixiApplication(false, 0);
		}
		if (BuildingPixiApplication == null) {
			BuildingPixiApplication = await BuildingPixiApplicationPromise;
		}

		const { width, height } = this.texture.frame;
		Assert(width === this.texture.source.pixelWidth);
		Assert(height === this.texture.source.pixelHeight);

		Assert(BuildingPixiApplication.canvas instanceof HTMLCanvasElement, 'Expected app.view to be an HTMLCanvasElement');

		BuildingPixiApplication.renderer.resolution = 1;
		BuildingPixiApplication.renderer.resize(width, height);
		BuildingPixiApplication.renderer.background.color = 0x000000;
		BuildingPixiApplication.renderer.background.alpha = 0;

		BuildingPixiApplication.stage.removeChildren();
		const sprite = new Sprite(this.texture);
		BuildingPixiApplication.stage.addChild(sprite);
		BuildingPixiApplication.render();
		BuildingPixiApplication.stage.removeChild(sprite);

		const canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;
		const context = canvas.getContext('2d', { willReadFrequently: true });
		Assert(context != null);
		context.clearRect(0, 0, width, height);
		context.drawImage(BuildingPixiApplication.canvas, 0, 0, width, height);
		const imageData = context.getImageData(0, 0, width, height, { colorSpace: 'srgb' });

		Assert(imageData.width === width);
		Assert(imageData.height === height);
		Assert(imageData.data.length === (4 * width * height));

		let left = width - 1;
		let top = height - 1;
		let rightExclusive = 0;
		let bottomExclusive = 0;

		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				const i = 4 * (y * width + x) + 3;

				// Check if the pixel is non-transparent
				if (imageData.data[i] > 0) {
					left = Math.min(left, x);
					top = Math.min(top, y);
					rightExclusive = Math.max(rightExclusive, x + 1);
					bottomExclusive = Math.max(bottomExclusive, y + 1);
				}
			}
		}

		let result: ImageBoundingBox;

		// Special case if the image is empty
		if (left === (width - 1) && top === (height - 1) && rightExclusive === 0 && bottomExclusive === 0) {
			result = {
				left: 0,
				top: 0,
				rightExclusive: 0,
				bottomExclusive: 0,
				width,
				height,
			};
		} else {
			Assert(left < rightExclusive);
			Assert(top < bottomExclusive);
			result = {
				left,
				top,
				rightExclusive,
				bottomExclusive,
				width,
				height,
			};
		}

		freeze(result);
		TextureBoundingBoxCache.set(this.texture, result);
		return result;
	}
}

export function EditorBuildAssetGraphicsContext(asset: EditorAssetGraphics, logicAsset: Asset, buildTextures?: Map<string, Texture>): GraphicsBuildContext {
	const graphicsManager = GraphicsManagerInstance.value;
	AssertNotNullable(graphicsManager);

	const builtAssetData: GraphicsBuildContext['builtAssetData'] = {
		modules: (logicAsset.isType('personal') || logicAsset.isType('bodypart')) ? (
			logicAsset.definition.modules
		) : undefined,
	};

	const textures = asset.textures.value;

	return {
		runImageBasedChecks: true,
		generateOptimizedTextures: buildTextures != null,
		generateResolutions: EMPTY_ARRAY,
		getPointTemplate(name) {
			return EditorAssetGraphicsManager.editedPointTemplates.value.get(name) ??
				EditorAssetGraphicsManager.originalPointTempalates[name];
		},
		getAutomeshTemplate(name) {
			return EditorAssetGraphicsManager.automeshTemplates.value[name];
		},
		bufferToBase64: ArrayToBase64,
		loadImage(image) {
			const texture = textures.get(image);
			if (texture == null) {
				throw new Error(`Image ${image} not found`);
			}
			return new EditorImageResource(image, texture, buildTextures);
		},
		builtAssetData,
	};
}

export async function EditorBuildAssetGraphics(
	asset: EditorAssetGraphics,
	logicAsset: Asset,
	logger: Logger,
	buildTextures: Map<string, Texture>,
): Promise<Immutable<AssetGraphicsDefinition>> {
	const assetLoadContext: GraphicsBuildContext = EditorBuildAssetGraphicsContext(asset, logicAsset, buildTextures);

	const layers = (await Promise.all(asset.layers.value.map((sourceLayer) =>
		LoadAssetLayer(sourceLayer.definition.value, assetLoadContext, logger)
			.then((layerBuildResult) => {
				// Add source map for the built layer
				for (const builtLayer of layerBuildResult) {
					AssetGraphicsSourceMap.set(builtLayer, sourceLayer);
				}
				return layerBuildResult;
			}),
	))).flat();

	return {
		layers,
	};
}
