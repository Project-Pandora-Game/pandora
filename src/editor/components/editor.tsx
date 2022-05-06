import { ICharacterData } from 'pandora-common';
import React, { ReactElement } from 'react';
import { Character } from '../../character/character';
import { useGraphicsScene } from '../../graphics/graphicsScene';
import { SetupCharacter, ResultCharacter } from '../graphics/character';
import { EditorScene } from '../graphics/editorScene';
import { AllLayers } from '../graphics/observable';
import './editor.scss';

const editorScene = new EditorScene();

let loaded = false;
function Load() {
	if (loaded)
		return;

	loaded = true;

	const editorCharacter = new Character<ICharacterData>({
		inCreation: true,
		id: 'c1',
		accountId: 1,
		name: 'Editor',
		created: -1,
		accessId: '------',
		bones: [
			['arm_r', 75],
			['arm_l', -75],
			['elbow_r', 100],
			['elbow_l', -10],
		],
		assets: [],
	});
	const setupCharacter = new SetupCharacter(editorScene, editorCharacter);
	editorScene.add(setupCharacter);
	const resultCharacter = new ResultCharacter(editorScene, editorCharacter);
	editorScene.add(resultCharacter);

	editorCharacter.update({
		assets: [{ id: 'asset-body' }],
	});

	AllLayers[0].selected = true;
}

export function Editor(): ReactElement {
	const ref = useGraphicsScene<HTMLDivElement>(editorScene);

	Load();

	return (
		<div className='editor'>
			<div ref={ ref } className='editor-scene' />
		</div>
	);
}
