import { Texture } from 'pixi.js';
import React, { ReactElement, useMemo } from 'react';
import { GraphicsLayerProps, GraphicsLayer } from '../../../graphics/graphicsLayer';
import { EditorAssetGraphics } from '../character/appearanceEditor';

export const EDITOR_LAYER_Z_INDEX_EXTRA = 10000;

export function EditorLayer({
	getTexture,
	layer,
	...props
}: GraphicsLayerProps): ReactElement {
	const editorGetTexture = useMemo<((image: string) => Promise<Texture>) | undefined>(() => {
		if (getTexture)
			return getTexture;
		if (layer.asset instanceof EditorAssetGraphics)
			return layer.asset.getTexture.bind(layer.asset);
		return undefined;
	}, [getTexture, layer]);

	return (
		<GraphicsLayer
			{ ...props }
			layer={ layer }
			getTexture={ editorGetTexture }
		/>
	);
}
