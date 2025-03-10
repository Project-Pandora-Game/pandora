import { ReactElement, useMemo } from 'react';
import { useAssetManager } from '../../../assets/assetManager.tsx';
import { Container } from '../../../graphics/baseComponents/container.ts';
import { useObservable } from '../../../observable.ts';
import { useEditor } from '../../editorContextProvider.tsx';
import { DraggableBone } from '../draggable.tsx';
import { EDITOR_LAYER_Z_INDEX_EXTRA } from '../layer/editorLayer.tsx';
import { SetupLayer, SetupLayerSelected } from '../layer/index.ts';
import { PointTemplateEditLayer } from '../pointTemplateEditor.tsx';
import { useEditorCharacterState } from './appearanceEditor.ts';
import { GraphicsCharacterEditor } from './editorCharacter.tsx';

export function SetupCharacter(): ReactElement {
	const editor = useEditor();
	const editorCharacterState = useEditorCharacterState();
	const assetManager = useAssetManager();
	const bones = useMemo(() => assetManager.getAllBones(), [assetManager]);
	const showBones = useObservable(editor.showBones);
	const selectedLayer = useObservable(editor.targetLayer);
	const selectedTemplate = useObservable(editor.targetTemplate);

	return (
		<GraphicsCharacterEditor layer={ SetupLayer }>
			{
				!selectedLayer ? null :
				(
					<SetupLayerSelected
						characterState={ editorCharacterState }
						layer={ selectedLayer }
						zIndex={ EDITOR_LAYER_Z_INDEX_EXTRA }
					/>
				)
			}
			{
				selectedTemplate == null ? null :
				(<PointTemplateEditLayer templateEditor={ selectedTemplate } />)
			}
			{
				!showBones ? null :
				(
					<Container zIndex={ EDITOR_LAYER_Z_INDEX_EXTRA + 1 }>
						{
							bones
								.filter((b) => b.x !== 0 && b.y !== 0)
								.map((b) => (
									<DraggableBone
										key={ b.name }
										type='setup'
										character={ editor.character }
										characterState={ editorCharacterState }
										definition={ b }
									/>
								))
						}
					</Container>
				)
			}
		</GraphicsCharacterEditor>
	);
}
