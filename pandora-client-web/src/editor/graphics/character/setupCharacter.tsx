import { ReactElement, useMemo } from 'react';
import { useAssetManager } from '../../../assets/assetManager';
import { Container } from '../../../graphics/baseComponents/container';
import { useObservable } from '../../../observable';
import { useEditor } from '../../editorContextProvider';
import { DraggableBone } from '../draggable';
import { SetupLayer, SetupLayerSelected } from '../layer';
import { EDITOR_LAYER_Z_INDEX_EXTRA } from '../layer/editorLayer';
import { PointTemplateEditLayer } from '../pointTemplateEditor';
import { useEditorCharacterState } from './appearanceEditor';
import { GraphicsCharacterEditor } from './editorCharacter';

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
