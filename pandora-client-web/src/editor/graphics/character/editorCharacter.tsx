import { ReactElement, useCallback, useEffect, useReducer } from 'react';
import { GraphicsCharacterProps, GraphicsCharacterWithManager, GraphicsGetterFunction, LayerStateOverrideGetter } from '../../../graphics/graphicsCharacter.tsx';
import { usePreviewCutterOverridesEnabled } from '../../components/previewCutter/previewCutter.tsx';
import { useEditor } from '../../editorContextProvider.tsx';
import { useEditorCharacterState } from './appearanceEditor.ts';

export type GraphicsCharacterEditorProps = Omit<GraphicsCharacterProps, 'characterState'>;

export function GraphicsCharacterEditor({
	children,
	...props
}: GraphicsCharacterEditorProps): ReactElement {
	const editor = useEditor();
	const editorCharacterState = useEditorCharacterState();
	const previewOverridesEnabled = usePreviewCutterOverridesEnabled();

	const [editorGettersVersion, editorGettersUpdate] = useReducer((s: number) => s + 1, 0);

	const graphicsGetter = useCallback<GraphicsGetterFunction>((id) => editor.getAssetGraphicsById(id),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[editor, editorGettersVersion],
	);

	const layerStateOverrideGetter = useCallback<LayerStateOverrideGetter>(
		(layer) => {
			if (previewOverridesEnabled) {
				const def = layer.definition.value;
				if (def.previewOverrides != null) {
					return def.previewOverrides;
				}
			}
			return editor.getLayerStateOverride(layer);
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[editor, editorGettersVersion, previewOverridesEnabled],
	);

	useEffect(() => {
		return editor.on('layerOverrideChange', () => editorGettersUpdate());
	}, [editor]);

	useEffect(() => {
		return editor.on('modifiedAssetsChange', () => editorGettersUpdate());
	}, [editor]);

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
