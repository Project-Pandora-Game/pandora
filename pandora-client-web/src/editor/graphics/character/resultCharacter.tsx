import { Container } from '@pixi/react';
import React, { ReactElement, useMemo } from 'react';
import { useAssetManager } from '../../../assets/assetManager';
import { useObservable } from '../../../observable';
import { useEditor } from '../../editorContextProvider';
import { DraggableBone } from '../draggable';
import { ResultLayer } from '../layer';
import { EDITOR_LAYER_Z_INDEX_EXTRA } from '../layer/editorLayer';
import { GraphicsCharacterEditor } from './editorCharacter';

export function ResultCharacter(): ReactElement {
	const editor = useEditor();
	const assetManager = useAssetManager();
	const bones = useMemo(() => assetManager.getAllBones(), [assetManager]);
	const showBones = useObservable(editor.showBones);

	return (
		<GraphicsCharacterEditor layer={ ResultLayer } >
			{
				!showBones ? null :
				(
					<Container zIndex={ EDITOR_LAYER_Z_INDEX_EXTRA }>
						{
							bones
								.filter((b) => b.x !== 0 && b.y !== 0)
								.map((b) => <DraggableBone type='result' character={ editor.character } definition={ b } key={ b.name } />)
						}
					</Container>
				)
			}
		</GraphicsCharacterEditor>
	);
}
