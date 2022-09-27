import React, { ReactElement, useCallback, useMemo, useState } from 'react';
import { EditorSetupScene, EditorResultScene, EditorScene } from './graphics/editorScene';
import { useEditor } from './editorContextProvider';
import { GraphicsSceneRenderer, SceneConstructor } from '../graphics/graphicsSceneRenderer';
import { Editor } from './editor';
import { Button } from '../components/common/Button/Button';
import { useEvent } from '../common/useEvent';
import { useNullableObservable } from '../observable';
import _ from 'lodash';

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
					title='Center the view'
					onClick={ () => {
						scene?.resize(true);
					} }
				>
					⊙
				</Button>
				<Button className='slim iconButton'
					title='Download as image'
					onClick={ () => {
						scene?.exportImage();
					} }
				>
					<u>⇣</u>
				</Button>
				<BackgroundColorPicker scene={ scene } throttle={ 30 } />
			</div>
		</GraphicsSceneRenderer>
	);
}

function BackgroundColorPicker({ scene, throttle }: { scene: EditorScene | null | undefined, throttle: number }): ReactElement {
	const background = useNullableObservable(scene?.background);
	const color = background?.[0] === '#' ? background : '#000000';

	const onChange = useEvent((ev: React.ChangeEvent<HTMLInputElement>) => {
		scene?.setBackground(ev.target.value);
	});

	const onChangeThrottled = useMemo(() => _.throttle(onChange, throttle), [onChange, throttle]);

	return (
		<input type='color' value={ color } onChange={ onChangeThrottled } />
	);
}

export function SetupView(): ReactElement {
	return <EditorView sceneType={ EditorSetupScene } />;
}

export function PreviewView(): ReactElement {
	return <EditorView sceneType={ EditorResultScene } />;
}
