import React, { useReducer, ReactElement } from 'react';
import { Button } from '../../../components/common/Button/Button';
import { useGraphicsScene } from '../../../graphics/graphicsScene';
import { EditorScene } from '../../graphics/editorScene';
import { AllLayers } from '../../graphics/observable';
import { AssetUI } from '../assets';
import { BoneUI } from '../bones';
import './editor.scss';

let loaded = false;

function Load() {
	if (loaded)
		return;

	loaded = true;

	EditorScene.init();

	AllLayers[0].selected = true;
}

export function Editor(): ReactElement {
	const ref = useGraphicsScene<HTMLDivElement>(EditorScene);
	const [ui, dispatch] = useReducer(UiReducer, 'assets');

	Load();

	return (
		<div className='editor'>
			<div className='editor-ui'>
				<div className='ui-selector'>
					<Button onClick={ () => dispatch('assets') }>Assets</Button>
					<Button onClick={ () => dispatch('bones') }>Bones</Button>
				</div>
				{ui === 'assets' && <AssetUI />}
				{ui === 'bones' && <BoneUI />}
			</div>
			<div ref={ ref } className='editor-scene' />
		</div>
	);
}

function UiReducer(_state: 'assets' | 'bones', action: 'assets' | 'bones') {
	return action;
}
