import React, { ReactElement, useCallback, useState } from 'react';
import { EditorSetupScene, EditorResultScene, EditorScene } from './graphics/editorScene';
import { useEditor } from './editorContextProvider';
import { GraphicsSceneRenderer, SceneConstructor } from '../graphics/graphicsSceneRenderer';
import { Editor } from './editor';
import { Button } from '../components/common/Button/Button';

function EditorView({ sceneType }: {
	sceneType: new (editor: Editor) => EditorScene;
}): ReactElement {
	const editor = useEditor();
	const [scene, setScene] = useState<EditorScene | null>();
	const sceneConstructor = useCallback<SceneConstructor<EditorScene>>(() => new sceneType(editor), [editor, sceneType]);

	return (
		<GraphicsSceneRenderer scene={ sceneConstructor } onScene={ setScene } className='canvasContainer'>
			<div className='overlay'>
				<Button className='slim iconButton'
					onClick={ () => {
						scene?.resize(true);
					} }
				>
					⊙
				</Button>
				<Button className='slim iconButton'
					onClick={ () => {
						scene?.exportImage();
					} }
				>
					<u>⇣</u>
				</Button>
			</div>
		</GraphicsSceneRenderer>
	);
}

export function SetupView(): ReactElement {
	return <EditorView sceneType={ EditorSetupScene } />;
}

export function PreviewView(): ReactElement {
	return <EditorView sceneType={ EditorResultScene } />;
}
