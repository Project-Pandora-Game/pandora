import React, { ReactElement } from 'react';
import { useGraphicsScene } from '../graphics/graphicsScene';
import { EditorSetupScene, EditorResultScene, EditorCharacter } from './graphics/editorScene';
import { AllLayers } from './graphics/observable';
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AssetUI } from './components/assets';
import { LayerUI } from './components/layers';
import { BoneUI } from './components/bones';
import './editor.scss';
import { Button } from '../components/common/Button/Button';

export class Editor {
	public readonly setupScene: EditorSetupScene;
	public readonly resultScene: EditorResultScene;

	constructor() {
		this.setupScene = new EditorSetupScene();
		this.resultScene = new EditorResultScene();

		EditorCharacter.update({
			assets: [{ id: 'a/base/body' }],
		});

		AllLayers[0].selected = true;
	}
}

function TabSelector(): ReactElement {
	const navigate = useNavigate();
	const location = useLocation();
	return (
		<>
			<Button className='slim' theme={ location.pathname === '/assets' ? 'defaultActive' : 'default' } onClick={ () => navigate('/assets') }>Assets</Button>
			<Button className='slim' theme={ location.pathname === '/layers' ? 'defaultActive' : 'default' } onClick={ () => navigate('/layers') }>Layers</Button>
			<Button className='slim' theme={ location.pathname === '/bones' ? 'defaultActive' : 'default' } onClick={ () => navigate('/bones') }>Bones</Button>
		</>
	);
}

export function EditorView({ editor }: { editor: Editor }): ReactElement {
	const refSetup = useGraphicsScene<HTMLDivElement>(editor.setupScene);
	const refResult = useGraphicsScene<HTMLDivElement>(editor.resultScene);

	return (
		<BrowserRouter basename='/editor'>
			<div className='editor'>
				<div className='editor-ui'>
					<div className='ui-selector'>
						<TabSelector />
					</div>
					<Routes>
						<Route path='*' element={ <AssetUI /> } />
						<Route path='/layers' element={ <LayerUI /> } />
						<Route path='/bones' element={ <BoneUI /> } />
					</Routes>
				</div>
				<div ref={ refSetup } className='editor-scene' />
				<div ref={ refResult } className='editor-scene' />
			</div>
		</BrowserRouter>
	);
}
