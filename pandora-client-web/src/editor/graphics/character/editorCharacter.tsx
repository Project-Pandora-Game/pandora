import type { AssetId } from 'pandora-common';
import { ReactElement, useCallback, useEffect, useMemo, useReducer } from 'react';
import { GraphicsManagerInstance } from '../../../assets/graphicsManager.ts';
import { GraphicsCharacterProps, GraphicsCharacterWithManager, GraphicsGetterFunction, LayerStateOverrideGetter } from '../../../graphics/graphicsCharacter.tsx';
import { useObservable } from '../../../observable.ts';
import { GetEditorSourceLayerForRuntimeLayer } from '../../assets/editorAssetCalculationHelpers.ts';
import type { EditorAssetGraphicsLayer } from '../../assets/editorAssetGraphicsLayer.ts';
import { usePreviewCutterOverridesEnabled } from '../../components/previewCutter/previewCutter.tsx';
import { useEditor } from '../../editorContextProvider.tsx';
import { useEditorCharacterState } from './appearanceEditor.ts';

export type GraphicsCharacterEditorProps = Omit<GraphicsCharacterProps, 'characterState'>;

export function GraphicsCharacterEditor({
	children,
	...props
}: GraphicsCharacterEditorProps): ReactElement | null {
	const editor = useEditor();
	const editorCharacterState = useEditorCharacterState();
	const previewOverridesEnabled = usePreviewCutterOverridesEnabled();

	const [editorGettersVersion, editorGettersUpdate] = useReducer((s: number) => s + 1, 0);

	const manager = useObservable(GraphicsManagerInstance);
	const assetGraphics = manager?.assetGraphics;
	const graphicsGetter = useMemo<GraphicsGetterFunction | undefined>(() => assetGraphics == null ? undefined : ((id: AssetId) => assetGraphics[id]), [assetGraphics]);

	const layerStateOverrideGetter = useCallback<LayerStateOverrideGetter>(
		(layer) => {
			if (previewOverridesEnabled) {
				if (layer.type === 'mesh' && layer.previewOverrides != null) {
					return layer.previewOverrides;
				}
			}
			const editorLayer: EditorAssetGraphicsLayer | null = GetEditorSourceLayerForRuntimeLayer(layer);
			return editorLayer != null ? editor.getLayerStateOverride(editorLayer) : undefined;
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[editor, editorGettersVersion, previewOverridesEnabled],
	);

	useEffect(() => {
		return editor.on('layerOverrideChange', () => editorGettersUpdate());
	}, [editor]);

	if (!graphicsGetter)
		return null;

	return (
		<GraphicsCharacterWithManager
			{ ...props }
			characterState={ editorCharacterState }
			graphicsGetter={ graphicsGetter }
			layerStateOverrideGetter={ layerStateOverrideGetter }
		>
			{ children }
		</GraphicsCharacterWithManager>
	);
}
