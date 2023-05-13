import { Container } from '@pixi/react';
import React, { ReactElement, useMemo } from 'react';
import { useAssetManager } from '../../../assets/assetManager';
import { PRIORITY_ORDER_SPRITES } from '../../../graphics/def';
import { useObservable } from '../../../observable';
import { useEditor } from '../../editorContextProvider';
import { DraggableBone } from '../draggable';
import { SetupLayer, SetupLayerSelected } from '../layer';
import { EDITOR_LAYER_Z_INDEX_EXTRA } from '../layer/editorLayer';
import { GraphicsCharacterEditor } from './editorCharacter';
import { useEditorCharacterState } from './appearanceEditor';

export function SetupCharacter(): ReactElement {
	const editor = useEditor();
	const editorCharacterState = useEditorCharacterState();
	const assetManager = useAssetManager();
	const bones = useMemo(() => assetManager.getAllBones(), [assetManager]);
	const showBones = useObservable(editor.showBones);
	const selectedLayer = useObservable(editor.targetLayer);

	return (
		<GraphicsCharacterEditor layer={ SetupLayer } getSortOrder={ (view) => {
			const reverse = view === 'back';
			return reverse ? PRIORITY_ORDER_SPRITES.slice().reverse() : PRIORITY_ORDER_SPRITES;
		} } >
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
