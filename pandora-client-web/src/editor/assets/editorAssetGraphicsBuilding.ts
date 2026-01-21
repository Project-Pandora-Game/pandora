import { type Immutable } from 'immer';
import {
	Assert,
	EMPTY_ARRAY,
	LoadAssetLayer,
	LoadAssetRoomDeviceLayer,
	type Asset,
	type AssetGraphicsRoomDeviceDefinition,
	type AssetGraphicsWornDefinition,
	type AssetManager,
	type GraphicsBuildContext,
	type GraphicsBuildContextAssetData,
	type GraphicsBuildContextRoomDeviceData,
	type GraphicsBuildImageResource,
	type GraphicsLayer,
	type ImageBoundingBox,
	type Logger,
	type RoomDeviceGraphicsLayer,
	type Size,
	type Writable,
} from 'pandora-common';
import { Application, Rectangle, Texture } from 'pixi.js';
import { ArrayToBase64 } from '../../crypto/helpers.ts';
import { CreatePixiApplication } from '../../graphics/graphicsAppManager.ts';
import { GetTextureBoundingBox } from '../../graphics/utility/textureBoundingBox.ts';
import type { EditorAssetGraphicsManagerClass } from './editorAssetGraphicsManager.ts';
import type { EditorAssetGraphicsRoomDeviceLayer } from './editorAssetGraphicsRoomDeviceLayer.ts';
import type { EditorAssetGraphicsWornLayer } from './editorAssetGraphicsWornLayer.ts';
import type { EditorAssetGraphicsBase } from './graphics/editorAssetGraphicsBase.ts';
import type { EditorAssetGraphicsRoomDevice } from './graphics/editorAssetGraphicsRoomDevice.ts';
import type { EditorWornLayersContainer } from './graphics/editorGraphicsLayerContainer.ts';

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

	public getSize(): Promise<Size> {
		return Promise.resolve({
			width: this.texture.frame.width,
			height: this.texture.frame.height,
		});
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
	editorGraphicsManager: EditorAssetGraphicsManagerClass,
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
			return editorGraphicsManager.editedPointTemplates.value.get(name) ??
				editorGraphicsManager.originalPointTemplates[name];
		},
		bufferToBase64: ArrayToBase64,
		loadImage(image) {
			const texture = textures.get(image);
			if (texture == null) {
				throw new Error(`Image ${image} not found`);
			}
			return new EditorImageResource(`editor://${encodeURIComponent(asset.id)}/${image}`, texture, buildTextures);
		},
		builtAssetData,
		assetManager,
	};
}

export function EditorBuiltAssetDataFromWornAsset(asset: Asset<'personal'> | Asset<'bodypart'>): Immutable<GraphicsBuildContextAssetData> {
	return {
		modules: asset.definition.modules,
		colorizationKeys: new Set(Object.keys(asset.definition.colorization ?? {})),
		supportsInRoomGraphics: asset.isType('personal') && asset.definition.roomDeployment != null,
	};
}

export function EditorBuildAssetGraphicsWornContext(
	asset: EditorAssetGraphicsBase,
	logicAsset: Asset<'personal'> | Asset<'bodypart'> | Asset<'roomDevice'>,
	assetManager: AssetManager,
	editorGraphicsManager: EditorAssetGraphicsManagerClass,
	buildTextures?: Map<string, Texture>,
): GraphicsBuildContext<Immutable<GraphicsBuildContextAssetData>> {
	if (logicAsset.isType('roomDevice')) {
		const roomDeviceBuildData = EditorBuiltAssetDataFromRoomDeviceAsset(logicAsset);

		return EditorBuildAssetGraphicsContext<Immutable<GraphicsBuildContextAssetData>>(
			asset,
			assetManager,
			editorGraphicsManager,
			{
				modules: roomDeviceBuildData.modules,
				colorizationKeys: roomDeviceBuildData.colorizationKeys,
				supportsInRoomGraphics: false,
			},
			buildTextures,
		);
	}
	return EditorBuildAssetGraphicsContext(asset, assetManager, editorGraphicsManager, EditorBuiltAssetDataFromWornAsset(logicAsset), buildTextures);
}

export function EditorBuiltAssetDataFromRoomDeviceAsset(asset: Asset<'roomDevice'>): Immutable<GraphicsBuildContextRoomDeviceData> {
	return {
		modules: asset.definition.modules,
		colorizationKeys: new Set(Object.keys(asset.definition.colorization ?? {})),
		slotIds: new Set(Object.keys(asset.definition.slots)),
	};
}

export function EditorBuildAssetRoomDeviceGraphicsContext(
	asset: EditorAssetGraphicsBase,
	logicAsset: Asset<'roomDevice'>,
	assetManager: AssetManager,
	editorGraphicsManager: EditorAssetGraphicsManagerClass,
	buildTextures?: Map<string, Texture>,
): GraphicsBuildContext<Immutable<GraphicsBuildContextRoomDeviceData>> {
	return EditorBuildAssetGraphicsContext(asset, assetManager, editorGraphicsManager, EditorBuiltAssetDataFromRoomDeviceAsset(logicAsset), buildTextures);
}

export async function EditorBuildWornAssetGraphics(
	asset: EditorWornLayersContainer,
	builtAssetData: Immutable<GraphicsBuildContextAssetData>,
	assetManager: AssetManager,
	editorGraphicsManager: EditorAssetGraphicsManagerClass,
	logger: Logger,
	buildTextures: Map<string, Texture>,
): Promise<Immutable<AssetGraphicsWornDefinition>> {
	const assetLoadContext: GraphicsBuildContext<Immutable<GraphicsBuildContextAssetData>> = EditorBuildAssetGraphicsContext(
		asset.assetGraphics,
		assetManager,
		editorGraphicsManager,
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

	const result: Writable<Immutable<AssetGraphicsWornDefinition>> = {
		type: 'worn',
		layers,
	};

	const roomLayers = asset.roomLayers.value;
	if (roomLayers != null) {
		if (!builtAssetData.supportsInRoomGraphics) {
			logger.warning('Room graphics is defined, but asset does not support room deployment');
		}

		const roomLoadContext = EditorBuildAssetGraphicsContext<Immutable<GraphicsBuildContextRoomDeviceData>>(
			asset.assetGraphics,
			assetManager,
			editorGraphicsManager,
			{
				modules: builtAssetData.modules,
				colorizationKeys: builtAssetData.colorizationKeys,
				slotIds: new Set(),
			},
			buildTextures,
		);
		const roomLayersLogger = logger.prefixMessages(`Room graphics:\n\t\t`);

		result.roomLayers = (await Promise.all(roomLayers.layers.value.map((sourceLayer) =>
			LoadAssetRoomDeviceLayer(sourceLayer.definition.value, roomLoadContext, roomLayersLogger)
				.then((layerBuildResult) => {
					// Add source map for the built layer
					for (const builtLayer of layerBuildResult) {
						AssetGraphicsRoomDeviceSourceMap.set(builtLayer, sourceLayer);
					}
					return layerBuildResult;
				}),
		))).flat();
	} else if (builtAssetData.supportsInRoomGraphics) {
		logger.warning('Asset supports room deployment, but in-room graphics are not defined');
	}

	return result;
}

export async function EditorBuildRoomDeviceAssetGraphics(
	asset: EditorAssetGraphicsRoomDevice,
	builtAssetData: Immutable<GraphicsBuildContextRoomDeviceData>,
	assetManager: AssetManager,
	editorGraphicsManager: EditorAssetGraphicsManagerClass,
	logger: Logger,
	buildTextures: Map<string, Texture>,
): Promise<{
	graphics: Immutable<AssetGraphicsRoomDeviceDefinition>;
	slotGraphics: Immutable<Record<string, AssetGraphicsWornDefinition>>;
}> {
	const assetLoadContext: GraphicsBuildContext<Immutable<GraphicsBuildContextRoomDeviceData>> = EditorBuildAssetGraphicsContext(
		asset,
		assetManager,
		editorGraphicsManager,
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
		const slotLogger = logger.prefixMessages(`Slot '${slot}':\n\t\t`);
		if (slotGraphicsSource.layers.value.length === 0) {
			slotLogger.warning('Slot has no layers. Either add layers or remove slot graphics altogether.');
		}

		const slotResult = await EditorBuildWornAssetGraphics(
			slotGraphicsSource,
			{
				modules: builtAssetData.modules,
				colorizationKeys: builtAssetData.colorizationKeys,
				supportsInRoomGraphics: false,
			},
			assetManager,
			editorGraphicsManager,
			slotLogger,
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
