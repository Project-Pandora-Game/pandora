import { ReactElement, useMemo } from 'react';
import { useAssetManager } from '../../../assets/assetManager.tsx';
import { Container } from '../../../graphics/baseComponents/container.ts';
import { useObservable } from '../../../observable.ts';
import { PreviewCutterRectangle } from '../../components/previewCutter/previewCutter.tsx';
import { useEditor } from '../../editorContextProvider.tsx';
import { DraggableBone } from '../draggable.tsx';
import { EDITOR_LAYER_Z_INDEX_EXTRA } from '../layer/editorLayer.tsx';
import { EditorResultGraphicsCharacterLayerBuilder } from '../layer/index.ts';
import { useEditorCharacterState } from './appearanceEditor.ts';
import { GraphicsCharacterEditor, type GraphicsCharacterEditorProps } from './editorCharacter.tsx';

export function ResultCharacter(props: Omit<GraphicsCharacterEditorProps, 'layerBuilder'>): ReactElement {
	const editor = useEditor();
	const editorCharacterState = useEditorCharacterState();
	const assetManager = useAssetManager();
	const bones = useMemo(() => assetManager.getAllBones(), [assetManager]);
	const showBones = useObservable(editor.showBones);

	return (
		<GraphicsCharacterEditor { ...props } layerBuilder={ EditorResultGraphicsCharacterLayerBuilder }>
			{ showBones ? (
				<Container zIndex={ EDITOR_LAYER_Z_INDEX_EXTRA }>
					{
						bones
							.filter((b) => b.x !== 0 && b.y !== 0)
							.map((b) => (
								<DraggableBone
									key={ b.name }
									type='result'
									character={ editor.character }
									characterState={ editorCharacterState }
									definition={ b }
								/>
							))
					}
				</Container>
			) : null }
			<Container zIndex={ EDITOR_LAYER_Z_INDEX_EXTRA }>
				<PreviewCutterRectangle />
			</Container>
		</GraphicsCharacterEditor>
	);
}
