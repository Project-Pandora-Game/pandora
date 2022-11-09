import { Container } from '@saitonakamura/react-pixi';
import { CharacterView } from 'pandora-common';
import React, { ReactElement } from 'react';
import { GetAssetManager } from '../../../assets/assetManager';
import { PRIORITY_ORDER_SPRITES } from '../../../graphics/def';
import { useObservable } from '../../../observable';
import { useEditor } from '../../editorContextProvider';
import { DraggableBone } from '../draggable';
import { SetupLayer, SetupLayerSelected } from '../layer';
import { EDITOR_LAYER_Z_INDEX_EXTRA } from '../layer/editorLayer';
import { GraphicsCharacterEditor } from './editorCharacter';

export function SetupCharacter(): ReactElement {
	const editor = useEditor();
	const assetManager = GetAssetManager();
	const bones = assetManager.getAllBones();
	const showBones = useObservable(editor.showBones);
	const selectedLayer = useObservable(editor.targetLayer);

	return (
		<GraphicsCharacterEditor Layer={ SetupLayer } getSortOrder={ (_armsPose, view) => {
			const reverse = view === CharacterView.BACK;
			return reverse ? PRIORITY_ORDER_SPRITES.slice().reverse() : PRIORITY_ORDER_SPRITES;
		} } >
			{
				!selectedLayer ? null :
				(
					<SetupLayerSelected
						appearanceContainer={ editor.character }
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
								.map((b) => <DraggableBone type='setup' character={ editor.character } definition={ b } key={ b.name } />)
						}
					</Container>
				)
			}
		</GraphicsCharacterEditor>
	);
}
