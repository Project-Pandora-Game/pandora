import { type Immutable } from 'immer';
import { Assert, AssertNotNullable, EMPTY_ARRAY, LoadAssetLayer, type Asset, type AssetGraphicsWornDefinition, type AssetManager, type GraphicsBuildContext, type GraphicsBuildContextAssetData, type GraphicsBuildImageResource, type GraphicsLayer, type ImageBoundingBox, type Logger } from 'pandora-common';
import { Application, Rectangle, Texture } from 'pixi.js';
import { GraphicsManagerInstance } from '../../assets/graphicsManager.ts';
import { ArrayToBase64 } from '../../crypto/helpers.ts';
import { CreatePixiApplication } from '../../graphics/graphicsAppManager.ts';
import { GetTextureBoundingBox } from '../../graphics/utility/textureBoundingBox.ts';
import type { EditorAssetGraphics } from './editorAssetGraphics.ts';
import type { EditorAssetGraphicsLayer } from './editorAssetGraphicsLayer.ts';
import { EditorAssetGraphicsManager } from './editorAssetGraphicsManager.ts';

/** Map to editor asset graphics source layer. Only used in editor. */
export const AssetGraphicsSourceMap = new WeakMap<Immutable<GraphicsLayer>, EditorAssetGraphicsLayer>();

let BuildingPixiApplication: Application | null = null;
let BuildingPixiApplicationPromise: Promise<Application> | null = null;

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
		if (BuildingPixiApplicationPromise == null) {
			BuildingPixiApplicationPromise = CreatePixiApplication(false);
		}
		if (BuildingPixiApplication == null) {
			BuildingPixiApplication = await BuildingPixiApplicationPromise;
		}

		return GetTextureBoundingBox(this.texture, BuildingPixiApplication);
	}
}

export function EditorBuildAssetGraphicsContext(asset: EditorAssetGraphics, logicAsset: Asset, assetManager: AssetManager, buildTextures?: Map<string, Texture>): GraphicsBuildContext {
	const graphicsManager = GraphicsManagerInstance.value;
	AssertNotNullable(graphicsManager);

	const builtAssetData: Immutable<GraphicsBuildContextAssetData> = {
		modules: (logicAsset.isType('personal') || logicAsset.isType('bodypart')) ? (
			logicAsset.definition.modules
		) : undefined,
		colorizationKeys: new Set(
			(logicAsset.isType('personal') || logicAsset.isType('bodypart') || logicAsset.isType('roomDevice')) ?
				Object.keys(logicAsset.definition.colorization ?? {}) :
				[],
		),
	};

	const textures = asset.textures.value;

	return {
		runImageBasedChecks: true,
		generateOptimizedTextures: buildTextures != null,
		generateResolutions: EMPTY_ARRAY,
		getBones() {
			return assetManager.getAllBones();
		},
		getPointTemplate(name) {
			return EditorAssetGraphicsManager.editedPointTemplates.value.get(name) ??
				EditorAssetGraphicsManager.originalPointTemplates[name];
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

export async function EditorBuildWornAssetGraphics(
	asset: EditorAssetGraphics,
	logicAsset: Asset,
	assetManager: AssetManager,
	logger: Logger,
	buildTextures: Map<string, Texture>,
): Promise<Immutable<AssetGraphicsWornDefinition>> {
	const assetLoadContext: GraphicsBuildContext = EditorBuildAssetGraphicsContext(asset, logicAsset, assetManager, buildTextures);

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
		type: 'worn',
		layers,
	};
}
