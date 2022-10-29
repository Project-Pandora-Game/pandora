import React, { ReactElement, useCallback, useEffect, useReducer } from 'react';
import { GraphicsCharacterProps, GraphicsCharacterWithManager, GraphicsGetterFunction, LayerStateOverrideGetter } from '../../../graphics/graphicsCharacter';
import { useEditor } from '../../editorContextProvider';

export type GraphicsCharacterEditorProps = Omit<GraphicsCharacterProps, 'appearanceContainer'>;

export function GraphicsCharacterEditor({
	children,
	...props
}: GraphicsCharacterEditorProps): ReactElement {
	const editor = useEditor();

	const [editorGettersVersion, editorGettersUpdate] = useReducer((s: number) => s + 1, 0);

	const graphicsGetter = useCallback<GraphicsGetterFunction>((id) => editor.getAssetGraphicsById(id),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[editor, editorGettersVersion],
	);

	const layerStateOverrideGetter = useCallback<LayerStateOverrideGetter>((layer) => editor.getLayerStateOverride(layer),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[editor, editorGettersVersion],
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
			appearanceContainer={ editor.character }
			graphicsGetter={ graphicsGetter }
			layerStateOverrideGetter={ layerStateOverrideGetter }
		>
			{ children }
		</GraphicsCharacterWithManager>
	);
}
