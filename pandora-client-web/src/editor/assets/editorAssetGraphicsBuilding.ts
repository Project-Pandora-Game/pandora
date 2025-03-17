import type { Immutable } from 'immer';
import { AssertNotNullable, EMPTY_ARRAY, LoadAssetLayer, type AssetGraphicsDefinition, type GraphicsBuildContext, type GraphicsBuildImageResource, type ImageBoundingBox, type Logger } from 'pandora-common';
import { AssetGraphicsSourceMap } from '../../assets/assetGraphics.ts';
import { GraphicsManagerInstance } from '../../assets/graphicsManager.ts';
import { ArrayToBase64 } from '../../crypto/helpers.ts';
import type { EditorAssetGraphics } from './editorAssetGraphics.ts';

class EditorImageResource implements GraphicsBuildImageResource {
	public readonly resultName: string;

	constructor(name: string) {
		this.resultName = name;
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
	public getContentBoundingBox(): Promise<ImageBoundingBox> {
		throw new Error('Image getContentBoundingBox is not supported in the editor.');
	}
}

export async function EditorBuildAssetGraphics(asset: EditorAssetGraphics, logger: Logger): Promise<Immutable<AssetGraphicsDefinition>> {
	const graphicsManager = GraphicsManagerInstance.value;
	AssertNotNullable(graphicsManager);

	const assetLoadContext: GraphicsBuildContext = {
		generateOptimizedTextures: false,
		generateResolutions: EMPTY_ARRAY,
		getPointTemplate(name) {
			return graphicsManager.getTemplate(name);
		},
		bufferToBase64: ArrayToBase64,
		loadImage(image) {
			return new EditorImageResource(image);
		},
	};

	return {
		layers: await Promise.all(asset.layers.value.map((sourceLayer) => {
			return LoadAssetLayer(sourceLayer.definition.value, assetLoadContext, logger)
				.then((builtLayer) => {
					// Add source map for the built layer
					AssetGraphicsSourceMap.set(builtLayer, sourceLayer);
					return builtLayer;
				});
		})),
	};
}
