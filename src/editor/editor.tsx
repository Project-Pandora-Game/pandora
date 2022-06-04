import React, { ReactElement, useSyncExternalStore } from 'react';
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
import { AssetGraphics, AssetGraphicsLayer } from '../assets/assetGraphics';
import { TypedEventEmitter } from '../event';
import { Observable } from '../observable';
import { EditorAssetGraphics } from './graphics/character/appearanceEditor';
import { AssetId, GetLogger, APPEARANCE_BUNDLE_DEFAULT, PointDefinition } from 'pandora-common';
import { LayerUI } from './components/layer/layer';
import { PointsUI } from './components/points/points';
import { DraggablePoint } from './graphics/draggable';
import { cloneDeep } from 'lodash';

const logger = GetLogger('Editor');

export const EDITOR_ALPHAS = [1, 0.6, 0];
export const EDITOR_ALPHA_ICONS = ['🌕', '🌓', '🌑'];

export class Editor extends TypedEventEmitter<{
	layerOverrideChange: AssetGraphicsLayer;
	modifiedAssetsChange: undefined;
}> {
	public readonly manager: GraphicsManager;
	public readonly character: EditorCharacter;
	public readonly setupScene: EditorSetupScene;
	public readonly resultScene: EditorResultScene;

	public readonly showBones = new Observable<boolean>(false);

	public readonly targetAsset = new Observable<EditorAssetGraphics | null>(null);
	public readonly targetLayer = new Observable<AssetGraphicsLayer | null>(null);
	public readonly targetPoint = new Observable<DraggablePoint | null>(null);

	constructor(manager: GraphicsManager) {
		super();

		this.targetAsset.subscribe((asset) => {
			if (this.targetLayer.value?.asset !== asset) {
				this.targetLayer.value = null;
			}
		});

		this.targetLayer.subscribe((layer) => {
			if (layer && this.targetAsset.value !== layer.asset) {
				logger.error('Set target layer with non-matching target asset', layer, this.targetAsset.value);
				this.targetLayer.value = null;
				layer = null;
			}
			if (this.targetPoint.value?.layer !== layer) {
				this.targetPoint.value = null;
			}
		});

		this.manager = manager;
		this.character = new EditorCharacter();
		this.setupScene = new EditorSetupScene(this);
		this.resultScene = new EditorResultScene(this);

		// Load some point templates
		const body = manager.getAssetGraphicsById('a/base/body');
		if (body) {
			for (const layer of body.layers) {
				if (Array.isArray(layer.definition.points)) {
					this.pointTemplates.set(layer.name, cloneDeep(layer.definition.points));
				}
			}
		}

		/* eslint-disable @typescript-eslint/naming-convention */
		this.character.appearance.importFromBundle({
			...APPEARANCE_BUNDLE_DEFAULT,
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

	private readonly editorGraphics = new Map<AssetId, EditorAssetGraphics>();
	private editorGraphicsKeys: readonly AssetId[] = [];

	public getModifiedAssetsList(): readonly AssetId[] {
		return this.editorGraphicsKeys;
	}

	public getAssetGraphicsById(id: AssetId): AssetGraphics | undefined {
		return this.editorGraphics.get(id) ?? this.manager.getAssetGraphicsById(id);
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

	public getLayersAlphaOverrideIndex(...layers: AssetGraphicsLayer[]): number {
		return layers.reduce<number | undefined>((prev, layer) => {
			const alpha = this.getLayerStateOverride(layer)?.alpha ?? 1;
			const index = EDITOR_ALPHAS.indexOf(alpha);
			if (index >= 0 && (prev === undefined || index < prev))
				return index;
			return prev;
		}, undefined) ?? 0;
	}

	public setLayerAlphaOverride(layers: readonly AssetGraphicsLayer[], index: number): void {
		const newAlpha = EDITOR_ALPHAS[index % EDITOR_ALPHAS.length];
		for (const layer of layers) {
			this.setLayerStateOverride(layer, {
				...this.getLayerStateOverride(layer),
				alpha: newAlpha,
			});
		}
	}

	public getLayerTint(layer: AssetGraphicsLayer): number {
		return this.getLayerStateOverride(layer)?.color ?? 0xffffff;
	}

	public setLayerTint(layer: AssetGraphicsLayer, tint: number): void {
		this.setLayerStateOverride(layer, {
			...this.getLayerStateOverride(layer),
			color: tint,
		});
	}

	public startEditAsset(asset: AssetId): void {
		let graphics = this.editorGraphics.get(asset);
		if (!graphics) {
			const originalGraphics = this.manager.getAssetGraphicsById(asset);
			graphics = new EditorAssetGraphics(
				this,
				asset,
				originalGraphics?.export(),
				() => {
					this.emit('modifiedAssetsChange', undefined);
				},
			);
			this.editorGraphics.set(asset, graphics);
			this.editorGraphicsKeys = Array.from(this.editorGraphics.keys());
			this.emit('modifiedAssetsChange', undefined);
			graphics.loadAllUsedImages(this.manager.loader)
				.catch((err) => logger.error('Error importing asset for editing', err));
		}
		this.targetAsset.value = graphics;
	}

	public readonly pointTemplates = new Map<string, PointDefinition[]>();
}

export function useEditorAssetLayers(asset: EditorAssetGraphics, includeMirror: boolean): readonly AssetGraphicsLayer[] {
	const layers = useSyncExternalStore((change) => asset.editor.on('modifiedAssetsChange', change), () => asset.layers);
	return includeMirror ? layers.flatMap((l) => l.mirror ? [l, l.mirror] : [l]) : layers;
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
						<Route path='/bones' element={ <BoneUI editor={ editor } /> } />
						<Route path='/asset' element={ <AssetUI editor={ editor } /> } />
						<Route path='/layer' element={ <LayerUI editor={ editor } /> } />
						<Route path='/points' element={ <PointsUI editor={ editor } /> } />
					</Routes>
				</div>
				<div ref={ refSetup } className='editor-scene' />
				<div ref={ refResult } className='editor-scene' />
			</div>
		</BrowserRouter>
	);
}
