import React, { createContext, ReactElement, useContext, useMemo, useSyncExternalStore } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AssetsUI } from './components/assets/assets';
import { AssetUI } from './components/asset/asset';
import { BoneUI } from './components/bones/bones';
import './editor.scss';
import { Button } from '../components/common/Button/Button';
import { GraphicsManager } from '../assets/graphicsManager';
import { LayerStateOverrides } from '../graphics/def';
import { AssetGraphics, AssetGraphicsLayer } from '../assets/assetGraphics';
import { TypedEventEmitter } from '../event';
import { Observable } from '../observable';
import { EditorAssetGraphics, EditorCharacter } from './graphics/character/appearanceEditor';
import { AssetId, GetLogger, APPEARANCE_BUNDLE_DEFAULT, CharacterSize, ZodMatcher, ParseArrayNotEmpty } from 'pandora-common';
import { LayerUI } from './components/layer/layer';
import { PointsUI } from './components/points/points';
import { DraggablePoint } from './graphics/draggable';
import { useEvent } from '../common/useEvent';
import { PreviewView, SetupView } from './editorViews';
import { useBrowserStorage } from '../browserStorage';
import z from 'zod';
import { AssetInfoUI } from './components/assetInfo/assetInfo';

const logger = GetLogger('Editor');

export const EDITOR_ALPHAS = [1, 0.6, 0];
export const EDITOR_ALPHA_ICONS = ['⯀', '⬕', '⬚'];

export class Editor extends TypedEventEmitter<{
	layerOverrideChange: AssetGraphicsLayer;
	modifiedAssetsChange: undefined;
}> {
	public readonly manager: GraphicsManager;
	public readonly character: EditorCharacter;

	public readonly showBones = new Observable<boolean>(false);

	public readonly targetAsset = new Observable<EditorAssetGraphics | null>(null);
	public readonly targetLayer = new Observable<AssetGraphicsLayer | null>(null);
	public readonly targetPoint = new Observable<DraggablePoint | null>(null);

	public readonly backgroundColor = new Observable<number>(0x1099bb);
	public readonly getCenter = new Observable<() => { x: number; y: number; }>(
		() => ({ x: CharacterSize.WIDTH / 2, y: CharacterSize.HEIGHT / 2 }),
	);

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

		// Prevent loosing progress
		window.addEventListener('beforeunload', (event) => {
			if (this.editorGraphics.size > 0) {
				event.preventDefault();
				return event.returnValue = 'Are you sure you want to exit?';
			}
			return undefined;
		}, { capture: true });

		this.character.appearance.importFromBundle({
			...APPEARANCE_BUNDLE_DEFAULT,
			items: [
				{ id: 'i/body', asset: 'a/body/base' },
			],
			pose: {},
		});
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
		const override = this.getLayerStateOverride(layer);
		if (override?.color !== undefined) {
			return override.color;
		}
		const { colorization } = layer.asset.asset.definition;
		if (colorization) {
			const index = layer.definition.colorizationIndex;
			if (index != null && index >= 0 && index < colorization.length) {
				return parseInt(colorization[index].default.substring(1), 16);
			}
		}
		return 0xffffff;
	}

	public setLayerTint(layer: AssetGraphicsLayer, tint: number | undefined): void {
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

			// Copy overrides of old layers onto new asset
			const originalAllLayers = originalGraphics?.allLayers;
			const graphicsAllLayers = graphics.allLayers;
			if (originalAllLayers?.length === graphicsAllLayers.length) {
				for (let i = 0; i < originalAllLayers.length; i++) {
					const override = this.layerStateOverrides.get(originalAllLayers[i]);
					if (override) {
						this.setLayerStateOverride(graphicsAllLayers[i], override);
					}
				}
			}

			this.emit('modifiedAssetsChange', undefined);
			graphics.loadAllUsedImages(this.manager.loader)
				.catch((err) => logger.error('Error importing asset for editing', err));
		}
		this.targetAsset.value = graphics;
	}

	public setBackgroundColor(color: number): void {
		this.backgroundColor.value = color;
		document.documentElement.style.setProperty('--editor-background-color', `#${color.toString(16)}`);
	}
}

export function useEditorAssetLayers(asset: EditorAssetGraphics, includeMirror: boolean): readonly AssetGraphicsLayer[] {
	const layers = useSyncExternalStore((change) => asset.editor.on('modifiedAssetsChange', change), () => asset.layers);
	return includeMirror ? layers.flatMap((l) => l.mirror ? [l, l.mirror] : [l]) : layers;
}

const TABS: [string, string, () => ReactElement][] = [
	['Poses', 'editor-ui', BoneUI],
	['Items', 'editor-ui', AssetsUI],
	['Asset', 'editor-ui', AssetUI],
	['Layer', 'editor-ui', LayerUI],
	['Points', 'editor-ui', PointsUI],
	['Asset Info', 'editor-ui', AssetInfoUI],
	['Setup', 'editor-scene', SetupView],
	['Preview', 'editor-scene', PreviewView],
];

const activeTabsContext = createContext({
	activeTabs: [] as readonly string[],
	setActiveTabs: (_tabs: string[]) => { /**/ },
});

function Tab({ tab, index }: { tab: string; index: number; }): ReactElement {
	const { activeTabs, setActiveTabs } = useContext(activeTabsContext);
	const setTab = useEvent((newSelection: string) => {
		const newTabs = activeTabs.slice();
		newTabs[index] = newSelection;
		setActiveTabs(newTabs);
	});
	const newTab = useEvent(() => {
		const newTabs = activeTabs.slice();
		newTabs.splice(index + 1, 0, tab);
		setActiveTabs(newTabs);
	});
	const closeTab = useEvent(() => {
		const newTabs = activeTabs.slice();
		newTabs.splice(index, 1);
		setActiveTabs(newTabs);
	});

	const currentTab = TABS.find((t) => t[0] === tab) ?? TABS[0];
	// eslint-disable-next-line @typescript-eslint/naming-convention
	const CurrentTabComponent = currentTab[2];

	return (
		<div className={ currentTab[1] }>
			<div className='ui-selector'>
				<div className='flex-1 center-flex'>
					<select
						value={ currentTab[0] }
						onChange={ (ev) => {
							setTab(ev.target.value);
						} }
						onWheel={ (ev) => {
							const el = ev.currentTarget;
							if (el === document.activeElement)
								return;
							if (ev.deltaY < 0) {
								ev.stopPropagation();
								ev.preventDefault();
								el.selectedIndex = Math.max(el.selectedIndex - 1, 0);
								setTab(el.options[el.selectedIndex].value);
							} else if (ev.deltaY > 0) {
								ev.stopPropagation();
								ev.preventDefault();
								el.selectedIndex = Math.min(el.selectedIndex + 1, el.length - 1);
								setTab(el.options[el.selectedIndex].value);
							}
						} }
					>
						{
							TABS.map((t) => (
								<option value={ t[0] } key={ t[0] }>{ t[0] }</option>
							))
						}
					</select>
					{
						(activeTabs.length > 1) && (
							<Button
								title='Close this tab'
								className='slim icon'
								theme='default'
								onClick={ closeTab }
							>
								✖
							</Button>
						)
					}
				</div>
				<Button
					title='Create a new tab to the right of this one'
					className='slim icon'
					theme='default'
					onClick={ newTab }
				>
					+
				</Button>
			</div>
			<CurrentTabComponent />
		</div>
	);
}

export function EditorView(): ReactElement {
	const [activeTabs, setActiveTabs] = useBrowserStorage('editor-tabs', ['Items', 'Asset', 'Preview'],
		ZodMatcher(
			z.array(z.enum(ParseArrayNotEmpty(TABS.map((t) => t[0])))),
		),
	);
	const context = useMemo(() => ({ activeTabs, setActiveTabs }), [activeTabs, setActiveTabs]);

	return (
		<BrowserRouter basename='/editor'>
			<activeTabsContext.Provider value={ context }>
				<div className='editor'>
					{ activeTabs.map((tab, index) => <Tab tab={ tab } index={ index } key={ index } />) }
				</div>
			</activeTabsContext.Provider>
		</BrowserRouter>
	);
}
