import { Texture } from 'pixi.js';
import { ReactElement, useMemo } from 'react';
import { GraphicsLayer } from '../../../graphics/layers/graphicsLayer.tsx';
import type { GraphicsLayerProps } from '../../../graphics/layers/graphicsLayerCommon.tsx';
import { useNullableObservable } from '../../../observable.ts';
import { GetEditorSourceLayerForRuntimeLayer } from '../../assets/editorAssetCalculationHelpers.ts';

export const EDITOR_LAYER_Z_INDEX_EXTRA = 10000;

export function EditorLayer({
	getTexture,
	layer,
	...props
}: GraphicsLayerProps): ReactElement {
	const editorLayer = GetEditorSourceLayerForRuntimeLayer(layer);
	const asset = editorLayer?.asset;
	const editorAssetTextures = useNullableObservable(asset?.textures);
	const editorAssetBuildTextures = useNullableObservable(asset?.buildTextures);

	const editorGetTexture = useMemo<((image: string) => Texture) | undefined>(() => {
		if (getTexture)
			return getTexture;
		if (editorAssetBuildTextures != null)
			return (image) => (editorAssetBuildTextures.get(image) ?? Texture.EMPTY);
		if (editorAssetTextures != null)
			return (image) => (editorAssetTextures.get(image) ?? Texture.EMPTY);
		return undefined;
	}, [getTexture, editorAssetBuildTextures, editorAssetTextures]);

	return (
		<GraphicsLayer
			{ ...props }
			layer={ layer }
			getTexture={ editorGetTexture }
		/>
	);
}
