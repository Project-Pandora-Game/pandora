import { type Immutable } from 'immer';
import { Assert, EMPTY_ARRAY, LoadAssetLayer, LoadAssetRoomDeviceLayer, type Asset, type AssetGraphicsRoomDeviceDefinition, type AssetGraphicsWornDefinition, type AssetManager, type GraphicsBuildContext, type GraphicsBuildContextAssetData, type GraphicsBuildContextRoomDeviceData, type GraphicsBuildImageResource, type GraphicsLayer, type ImageBoundingBox, type Logger, type RoomDeviceGraphicsLayer } from 'pandora-common';
import { Application, Rectangle, Texture } from 'pixi.js';
import { ArrayToBase64 } from '../../crypto/helpers.ts';
import { CreatePixiApplication } from '../../graphics/graphicsAppManager.ts';
import { GetTextureBoundingBox } from '../../graphics/utility/textureBoundingBox.ts';
import { EditorAssetGraphicsManager } from './editorAssetGraphicsManager.ts';
import type { EditorAssetGraphicsRoomDeviceLayer } from './editorAssetGraphicsRoomDeviceLayer.ts';
import type { EditorAssetGraphicsWornLayer } from './editorAssetGraphicsWornLayer.ts';
import type { EditorAssetGraphicsBase } from './graphics/editorAssetGraphicsBase.ts';
import type { EditorAssetGraphicsRoomDevice } from './graphics/editorAssetGraphicsRoomDevice.ts';
import type { EditorWornLayersContainer } from './graphics/editorAssetGraphicsWorn.ts';

/** Map to editor asset graphics source layer. Only used in editor. */
export const AssetGraphicsWornSourceMap = new WeakMap<Immutable<GraphicsLayer>, EditorAssetGraphicsWornLayer>();

/** Map to editor asset graphics source layer. Only used in editor. */
export const AssetGraphicsRoomDeviceSourceMap = new WeakMap<Immutable<RoomDeviceGraphicsLayer>, EditorAssetGraphicsRoomDeviceLayer>();

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

export function EditorBuildAssetGraphicsContext<TAssetData>(
	asset: EditorAssetGraphicsBase,
	assetManager: AssetManager,
	builtAssetData: TAssetData,
	buildTextures?: Map<string, Texture>,
): GraphicsBuildContext<TAssetData> {
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

export function EditorBuiltAssetDataFromWornAsset(asset: Asset<'personal'> | Asset<'bodypart'>): Immutable<GraphicsBuildContextAssetData> {
	return {
		modules: asset.definition.modules,
		colorizationKeys: new Set(Object.keys(asset.definition.colorization ?? {})),
	};
}

export function EditorBuildAssetGraphicsWornContext(
	asset: EditorAssetGraphicsBase,
	logicAsset: Asset<'personal'> | Asset<'bodypart'> | Asset<'roomDevice'>,
	assetManager: AssetManager,
	buildTextures?: Map<string, Texture>,
): GraphicsBuildContext<Immutable<GraphicsBuildContextAssetData>> {
	if (logicAsset.isType('roomDevice')) {
		const roomDeviceBuildData = EditorBuiltAssetDataFromRoomDeviceAsset(logicAsset);

		return EditorBuildAssetGraphicsContext<Immutable<GraphicsBuildContextAssetData>>(
			asset,
			assetManager,
			{
				modules: roomDeviceBuildData.modules,
				colorizationKeys: roomDeviceBuildData.colorizationKeys,
			},
			buildTextures,
		);
	}
	return EditorBuildAssetGraphicsContext(asset, assetManager, EditorBuiltAssetDataFromWornAsset(logicAsset), buildTextures);
}

export function EditorBuiltAssetDataFromRoomDeviceAsset(asset: Asset<'roomDevice'>): Immutable<GraphicsBuildContextRoomDeviceData> {
	return {
		modules: asset.definition.modules,
		colorizationKeys: new Set(Object.keys(asset.definition.colorization ?? {})),
		slotIds: new Set(Object.keys(asset.definition.slots)),
	};
}

export function EditorBuildAssetRoomDeviceGraphicsContext(
	asset: EditorAssetGraphicsRoomDevice,
	logicAsset: Asset<'roomDevice'>,
	assetManager: AssetManager,
	buildTextures?: Map<string, Texture>,
): GraphicsBuildContext<Immutable<GraphicsBuildContextRoomDeviceData>> {
	return EditorBuildAssetGraphicsContext(asset, assetManager, EditorBuiltAssetDataFromRoomDeviceAsset(logicAsset), buildTextures);
}

export async function EditorBuildWornAssetGraphics(
	asset: EditorWornLayersContainer,
	builtAssetData: Immutable<GraphicsBuildContextAssetData>,
	assetManager: AssetManager,
	logger: Logger,
	buildTextures: Map<string, Texture>,
): Promise<Immutable<AssetGraphicsWornDefinition>> {
	const assetLoadContext: GraphicsBuildContext<Immutable<GraphicsBuildContextAssetData>> = EditorBuildAssetGraphicsContext(
		asset.assetGraphics,
		assetManager,
		builtAssetData,
		buildTextures,
	);

	const layers = (await Promise.all(asset.layers.value.map((sourceLayer) =>
		LoadAssetLayer(sourceLayer.definition.value, assetLoadContext, logger)
			.then((layerBuildResult) => {
				// Add source map for the built layer
				for (const builtLayer of layerBuildResult) {
					AssetGraphicsWornSourceMap.set(builtLayer, sourceLayer);
				}
				return layerBuildResult;
			}),
	))).flat();

	return {
		type: 'worn',
		layers,
	};
}

export async function EditorBuildRoomDeviceAssetGraphics(
	asset: EditorAssetGraphicsRoomDevice,
	builtAssetData: Immutable<GraphicsBuildContextRoomDeviceData>,
	assetManager: AssetManager,
	logger: Logger,
	buildTextures: Map<string, Texture>,
): Promise<{
	graphics: Immutable<AssetGraphicsRoomDeviceDefinition>;
	slotGraphics: Immutable<Record<string, AssetGraphicsWornDefinition>>;
}> {
	const assetLoadContext: GraphicsBuildContext<Immutable<GraphicsBuildContextRoomDeviceData>> = EditorBuildAssetGraphicsContext(
		asset,
		assetManager,
		builtAssetData,
		buildTextures,
	);

	const layers = (await Promise.all(asset.layers.value.map((sourceLayer) =>
		LoadAssetRoomDeviceLayer(sourceLayer.definition.value, assetLoadContext, logger)
			.then((layerBuildResult) => {
				// Add source map for the built layer
				for (const builtLayer of layerBuildResult) {
					AssetGraphicsRoomDeviceSourceMap.set(builtLayer, sourceLayer);
				}
				return layerBuildResult;
			}),
	))).flat();

	const slotGraphics: Record<string, Immutable<AssetGraphicsWornDefinition>> = {};
	for (const [slot, slotGraphicsSource] of asset.slotGraphics.value) {
		const slotResult = await EditorBuildWornAssetGraphics(
			slotGraphicsSource,
			{
				modules: builtAssetData.modules,
				colorizationKeys: builtAssetData.colorizationKeys,
			},
			assetManager,
			logger.prefixMessages(`Slot '${slot}':\n\t\t`),
			buildTextures,
		);

		slotGraphics[slot] = slotResult;
	}

	return {
		graphics: {
			type: 'roomDevice',
			layers,
		},
		slotGraphics,
	};
}
