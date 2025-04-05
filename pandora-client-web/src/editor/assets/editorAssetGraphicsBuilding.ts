import { freeze, type Immutable } from 'immer';
import { Assert, AssertNotNullable, EMPTY_ARRAY, LoadAssetLayer, type Asset, type AssetGraphicsDefinition, type GraphicsBuildContext, type GraphicsBuildImageResource, type GraphicsLayer, type ImageBoundingBox, type Logger } from 'pandora-common';
import { Application, Texture } from 'pixi.js';
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

	constructor(name: string, texture: Texture) {
		this.resultName = name;
		this.texture = texture;
	}

	public addCutImageRelative(_left: number, _top: number, _right: number, _bottom: number): GraphicsBuildImageResource {
		throw new Error('Transform addCutImageRelative is not supported in the editor.');
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
			BuildingPixiApplicationPromise = CreatePixiApplication(true);
		}
		if (BuildingPixiApplication == null) {
			BuildingPixiApplication = await BuildingPixiApplicationPromise;
		}

		const pixels = BuildingPixiApplication.renderer.texture.getPixels(this.texture);

		Assert(pixels.width === this.texture.source.pixelWidth);
		Assert(pixels.height === this.texture.source.pixelHeight);
		Assert(pixels.pixels.length === (4 * pixels.width * pixels.height));

		let left = pixels.width - 1;
		let top = pixels.height - 1;
		let rightExclusive = 0;
		let bottomExclusive = 0;

		for (let y = 0; y < pixels.height; y++) {
			for (let x = 0; x < pixels.width; x++) {
				const i = 4 * (y * pixels.width + x) + 3;

				// Check if the pixel is non-transparent
				if (pixels.pixels[i] > 0) {
					left = Math.min(left, x);
					top = Math.min(top, y);
					rightExclusive = Math.max(rightExclusive, x + 1);
					bottomExclusive = Math.max(bottomExclusive, y + 1);
				}
			}
		}

		let result: ImageBoundingBox;

		// Special case if the image is empty
		if (left === (pixels.width - 1) && top === (pixels.height - 1) && rightExclusive === 0 && bottomExclusive === 0) {
			result = {
				left: 0,
				top: 0,
				rightExclusive: 0,
				bottomExclusive: 0,
				width: pixels.width,
				height: pixels.height,
			};
		} else {
			Assert(left < rightExclusive);
			Assert(top < bottomExclusive);
			result = {
				left,
				top,
				rightExclusive,
				bottomExclusive,
				width: pixels.width,
				height: pixels.height,
			};
		}

		freeze(result);
		TextureBoundingBoxCache.set(this.texture, result);
		return result;
	}
}

export function EditorBuildAssetGraphicsContext(asset: EditorAssetGraphics, logicAsset: Asset): GraphicsBuildContext {
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
		generateOptimizedTextures: false,
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
			return new EditorImageResource(image, texture);
		},
		builtAssetData,
	};
}

export async function EditorBuildAssetGraphics(asset: EditorAssetGraphics, logicAsset: Asset, logger: Logger): Promise<Immutable<AssetGraphicsDefinition>> {
	const assetLoadContext: GraphicsBuildContext = EditorBuildAssetGraphicsContext(asset, logicAsset);

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
