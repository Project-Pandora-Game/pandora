import React, { ReactElement } from 'react';
import { useGraphicsScene } from '../graphics/graphicsScene';
import { EditorSetupScene, EditorResultScene } from './graphics/editorScene';
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AssetsUI } from './components/assets/assets';
import { AssetUI } from './components/asset/asset';
import { BoneUI } from './components/bones/bones';
import './editor.scss';
import { Button } from '../components/common/Button/Button';
import { EditorCharacter } from './graphics/character/editorCharacter';
import { GraphicsManager } from '../assets/graphicsManager';
import { LayerStateOverrides } from '../graphics/def';
import { AssetGraphicsLayer } from '../assets/assetGraphics';
import { TypedEventEmitter } from '../event';

export class Editor extends TypedEventEmitter<{
	layerOverrideChange: AssetGraphicsLayer;
}> {
	public readonly manager: GraphicsManager;
	public readonly character: EditorCharacter;
	public readonly setupScene: EditorSetupScene;
	public readonly resultScene: EditorResultScene;

	constructor(manager: GraphicsManager) {
		super();
		this.manager = manager;
		this.character = new EditorCharacter();
		this.setupScene = new EditorSetupScene(this, manager);
		this.resultScene = new EditorResultScene(this, manager);

		/* eslint-disable @typescript-eslint/naming-convention */
		this.character.appearance.importFromBundle({
			items: [
				{ id: 'i/body', asset: 'a/base/body' },
			],
			pose: {
				arm_r: 75,
				arm_l: -75,
				elbow_r: 100,
				elbow_l: -10,
			},
		});
		/* eslint-enable @typescript-eslint/naming-convention */
	}

	private readonly layerStateOverrides = new WeakMap<AssetGraphicsLayer, LayerStateOverrides>();

	public getLayerStateOverride(layer: AssetGraphicsLayer): LayerStateOverrides | undefined {
		return this.layerStateOverrides.get(layer);
	}

	public setLayerStateOverride(layer: AssetGraphicsLayer, override: LayerStateOverrides | undefined): void {
		if (override) {
			this.layerStateOverrides.set(layer, override);
		} else {
			this.layerStateOverrides.delete(layer);
		}
		this.emit('layerOverrideChange', layer);
	}
}

function TabSelector(): ReactElement {
	const navigate = useNavigate();
	const location = useLocation();
	return (
		<>
			<div className='ui-selector'>
				<Button className='slim' theme={ location.pathname === '/' ? 'defaultActive' : 'default' } onClick={ () => navigate('/') }>Global</Button>
				<Button className='slim' theme={ location.pathname === '/bones' ? 'defaultActive' : 'default' } onClick={ () => navigate('/bones') }>Bones</Button>
			</div>
			<div className='ui-selector'>
				<Button className='slim' theme={ location.pathname === '/asset' ? 'defaultActive' : 'default' } onClick={ () => navigate('/asset') }>Asset</Button>
				<Button className='slim' theme={ location.pathname === '/layer' ? 'defaultActive' : 'default' } onClick={ () => navigate('/layer') }>Layer</Button>
				<Button className='slim' theme={ location.pathname === '/points' ? 'defaultActive' : 'default' } onClick={ () => navigate('/points') }>Points</Button>
			</div>
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
					<TabSelector />
					<Routes>
						<Route path='*' element={ <AssetsUI editor={ editor } /> } />
						<Route path='/bones' element={ <BoneUI character={ editor.character } /> } />
						<Route path='/asset' element={ <AssetUI /> } />
						<Route path='/layer' element={ <AssetUI /> } />
						<Route path='/points' element={ <AssetUI /> } />
					</Routes>
				</div>
				<div ref={ refSetup } className='editor-scene' />
				<div ref={ refResult } className='editor-scene' />
			</div>
		</BrowserRouter>
	);
}
