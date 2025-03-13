import { Texture } from 'pixi.js';
import { ReactElement, useEffect, useMemo, useReducer } from 'react';
import { GraphicsLayer } from '../../../graphics/layers/graphicsLayer.tsx';
import type { GraphicsLayerProps } from '../../../graphics/layers/graphicsLayerCommon.tsx';
import { useEditor } from '../../editorContextProvider.tsx';
import { EditorAssetGraphics } from '../character/appearanceEditor.ts';

export const EDITOR_LAYER_Z_INDEX_EXTRA = 10000;

export function EditorLayer({
	getTexture,
	layer,
	...props
}: GraphicsLayerProps): ReactElement {
	const editor = useEditor();
	const [editorGettersVersion, editorGettersUpdate] = useReducer((s: number) => s + 1, 0);

	const asset = layer.asset;

	// TODO: Make editor asset's images observable
	const editorGetTexture = useMemo<((image: string) => Texture) | undefined>(() => {
		if (getTexture)
			return getTexture;
		if (asset instanceof EditorAssetGraphics)
			return (image) => asset.getTexture(image);
		return undefined;
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [getTexture, layer, editorGettersVersion]);

	useEffect(() => {
		if (asset instanceof EditorAssetGraphics) {
			return editor.on('modifiedAssetsChange', () => editorGettersUpdate());
		}
		return undefined;
	}, [editor, asset]);

	return (
		<GraphicsLayer
			{ ...props }
			layer={ layer }
			getTexture={ editorGetTexture }
		/>
	);
}
