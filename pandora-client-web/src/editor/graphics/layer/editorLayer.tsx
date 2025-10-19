import { Texture } from 'pixi.js';
import { ReactElement, useMemo, type ReactNode } from 'react';
import { UseTextureGetterOverride } from '../../../graphics/useTexture.ts';
import { useNullableObservable } from '../../../observable.ts';
import type { EditorAssetGraphics } from '../../assets/graphics/editorAssetGraphics.ts';

export const EDITOR_LAYER_Z_INDEX_EXTRA = 10000;

export function EditorUseTextureGetterOverride({ asset, children }: {
	asset: EditorAssetGraphics | undefined;
	children: ReactNode;
}): ReactElement {
	const editorAssetTextures = useNullableObservable(asset?.textures);
	const editorAssetBuildTextures = useNullableObservable(asset?.buildTextures);

	const editorGetTexture = useMemo<((image: string) => Texture) | undefined>(() => {
		if (editorAssetBuildTextures != null)
			return (image) => (editorAssetBuildTextures.get(image) ?? Texture.EMPTY);
		if (editorAssetTextures != null)
			return (image) => (editorAssetTextures.get(image) ?? Texture.EMPTY);
		return undefined;
	}, [editorAssetBuildTextures, editorAssetTextures]);

	return (
		<UseTextureGetterOverride value={ editorGetTexture }>
			{ children }
		</UseTextureGetterOverride>
	);
}
