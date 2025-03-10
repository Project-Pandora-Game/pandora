import type { Immutable } from 'immer';
import { noop } from 'lodash-es';
import { Assert, AssertNotNullable, AssetFrameworkCharacterState, AssetFrameworkGlobalState, AssetFrameworkGlobalStateContainer, AssetFrameworkRoomState, AssetId, CharacterSize, GetLogger, HexColorString, ParseArrayNotEmpty, TypedEventEmitter, type LayerStateOverrides, type PointTemplate } from 'pandora-common';
import { createContext, ReactElement, useContext, useMemo, useSyncExternalStore } from 'react';
import { z } from 'zod';
import { AssetGraphics, AssetGraphicsLayer } from '../assets/assetGraphics.ts';
import { useGraphicsAsset, useLayerDefinition } from '../assets/assetGraphicsCalculations.ts';
import { GetCurrentAssetManager } from '../assets/assetManager.tsx';
import { GraphicsManager } from '../assets/graphicsManager.ts';
import { useBrowserStorage } from '../browserStorage.ts';
import { useEvent } from '../common/useEvent.ts';
import { Select } from '../common/userInteraction/select/select.tsx';
import { Button } from '../components/common/button/button.tsx';
import { LocalErrorBoundary } from '../components/error/localErrorBoundary.tsx';
import { Observable } from '../observable.ts';
import { AssetManagerEditor, EditorAssetManager } from './assets/assetManager.ts';
import { AssetUI } from './components/asset/asset.tsx';
import { AssetInfoUI } from './components/assetInfo/assetInfo.tsx';
import { AssetsUI } from './components/assets/assets.tsx';
import { BoneUI } from './components/bones/bones.tsx';
import { LayerUI } from './components/layer/layer.tsx';
import { PointsUI } from './components/points/points.tsx';
import { EditorWardrobeUI } from './components/wardrobe/wardrobe.tsx';
import './editor.scss';
import { useEditor } from './editorContextProvider.tsx';
import { EDITOR_CHARACTER_ID, EditorAssetGraphics, EditorCharacter } from './graphics/character/appearanceEditor.ts';
import { EditorResultScene, EditorSetupScene } from './graphics/editorScene.tsx';
import type { PointTemplateEditor } from './graphics/pointTemplateEditor.tsx';

const logger = GetLogger('Editor');

export const EDITOR_ALPHAS = [1, 0.6, 0];
export const EDITOR_ALPHA_ICONS = ['⯀', '⬕', '⬚'];

export class Editor extends TypedEventEmitter<{
	layerOverrideChange: AssetGraphicsLayer;
	modifiedAssetsChange: undefined;
	globalStateChange: true;
}> {
	public readonly manager: GraphicsManager;
	public readonly globalState: AssetFrameworkGlobalStateContainer;
	public readonly character: EditorCharacter;

	public readonly showBones = new Observable<boolean>(false);

	public readonly targetAsset = new Observable<EditorAssetGraphics | null>(null);
	public readonly targetLayer = new Observable<AssetGraphicsLayer | null>(null);

	public readonly targetTemplate = new Observable<PointTemplateEditor | null>(null);

	public readonly backgroundColor = new Observable<HexColorString>('#1099bb');
	public readonly getCenter = new Observable<() => { x: number; y: number; }>(
		() => ({ x: CharacterSize.WIDTH / 2, y: CharacterSize.HEIGHT / 2 }),
	);

	public readonly modifiedPointTemplates = new Observable<ReadonlyMap<string, Immutable<PointTemplate>>>(new Map());

	constructor(assetManager: AssetManagerEditor, graphicsManager: GraphicsManager) {
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
		});

		this.manager = graphicsManager;

		this.globalState = new AssetFrameworkGlobalStateContainer(
			logger.prefixMessages('[Asset framework state]'),
			() => {
				this.emit('globalStateChange', true);
			},
			AssetFrameworkGlobalState
				.createDefault(assetManager, AssetFrameworkRoomState.createDefault(assetManager))
				.withCharacter(
					EDITOR_CHARACTER_ID,
					AssetFrameworkCharacterState
						.createDefault(assetManager, EDITOR_CHARACTER_ID)
						.produceWithRestrictionOverride({ type: 'safemode', allowLeaveAt: 0 }),
				),
		);

		this.character = new EditorCharacter(this);

		EditorAssetManager.on('assetMangedChanged', (newAssetManager) => {
			this.globalState.reloadAssetManager(newAssetManager);
		});

		// Prevent loosing progress
		window.addEventListener('beforeunload', (event) => {
			if (this.editorGraphics.size > 0) {
				event.preventDefault();
				// eslint-disable-next-line @typescript-eslint/no-deprecated
				return event.returnValue = 'Are you sure you want to exit?';
			}
			return undefined;
		}, { capture: true });
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

			// Wear this asset if not currently wearing it (but only if starting edit for the first time)
			if (this.character.getAppearance().listItemsByAsset(asset).length === 0) {
				const actualAsset = GetCurrentAssetManager().getAssetById(asset);
				AssertNotNullable(actualAsset);
				this.character.getAppearance().addItem(actualAsset);
			}
		}
		this.targetAsset.value = graphics;
	}

	public setBackgroundColor(color: HexColorString): void {
		this.backgroundColor.value = color;
		document.documentElement.style.setProperty('--editor-background-color', color);
	}
}

export function useEditorLayerStateOverride(layer: AssetGraphicsLayer): LayerStateOverrides | undefined {
	const editor = useEditor();
	return useSyncExternalStore((changed) => {
		return editor.on('layerOverrideChange', (changedLayer) => {
			if (changedLayer === layer) {
				changed();
			}
		});
	}, () => editor.getLayerStateOverride(layer));
}

export function useEditorLayerTint(layer: AssetGraphicsLayer): number {
	const override = useEditorLayerStateOverride(layer);
	const { colorizationKey } = useLayerDefinition(layer);
	const asset = useGraphicsAsset(layer.asset);
	if (override?.color !== undefined) {
		return override.color;
	}
	if (asset.isType('bodypart') || asset.isType('personal')) {
		const { colorization } = asset.definition;
		if (colorization && colorizationKey) {
			const value = colorization[colorizationKey];
			if (value) {
				return parseInt(value.default.substring(1), 16);
			}
		}
	}
	return 0xffffff;
}

export function useEditorAssetLayers(asset: EditorAssetGraphics, includeMirror: boolean): readonly AssetGraphicsLayer[] {
	const layers = useSyncExternalStore((change) => asset.editor.on('modifiedAssetsChange', change), () => asset.layers);
	return includeMirror ? layers.flatMap((l) => l.mirror ? [l, l.mirror] : [l]) : layers;
}

const TABS = [
	['Wardrobe', 'editor-ui', EditorWardrobeUI],
	['Poses', 'editor-ui', BoneUI],
	['Items', 'editor-ui', AssetsUI],
	['Asset', 'editor-ui', AssetUI],
	['Layer', 'editor-ui', LayerUI],
	['Points', 'editor-ui', PointsUI],
	['Asset Info', 'editor-ui', AssetInfoUI],
	['Setup', 'editor-scene', EditorSetupScene],
	['Preview', 'editor-scene', EditorResultScene],
] as const;

type TabsName = (typeof TABS)[number][0];

const activeTabsContext = createContext({
	activeTabs: [] as readonly TabsName[],
	setActiveTabs: (_tabs: TabsName[]) => { /**/ },
});

export interface EditorCurrentTabContext {
	activeTabs: readonly TabsName[];
	setTab(tab: TabsName): void;
	closeTab(): void;
}

export function useEditorTabContext(): EditorCurrentTabContext {
	return useContext(currentTabContext);
}

const currentTabContext = createContext<EditorCurrentTabContext>({
	activeTabs: [],
	setTab: noop,
	closeTab: noop,
});

function Tab({ tab, index }: { tab: TabsName; index: number; }): ReactElement {
	const { activeTabs, setActiveTabs } = useContext(activeTabsContext);
	const setTab = useEvent((newSelection: TabsName) => {
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
	const CurrentTabComponent = currentTab[2];

	const context = useMemo<EditorCurrentTabContext>(() => ({
		activeTabs,
		setTab,
		closeTab,
	}), [activeTabs, setTab, closeTab]);

	return (
		<div className={ currentTab[1] }>
			<div className='ui-selector'>
				<div className='flex-1 center-flex'>
					<Select
						value={ currentTab[0] }
						onChange={ (ev) => {
							Assert(TABS.some((t) => t[0] === ev.target.value));
							setTab(ev.target.value as TabsName);
						} }
					>
						{
							TABS.map((t) => (
								<option value={ t[0] } key={ t[0] }>{ t[0] }</option>
							))
						}
					</Select>
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
			<currentTabContext.Provider value={ context }>
				<LocalErrorBoundary>
					<CurrentTabComponent />
				</LocalErrorBoundary>
			</currentTabContext.Provider>
		</div>
	);
}

export function EditorView(): ReactElement {
	const [activeTabs, setActiveTabs] = useBrowserStorage<TabsName[]>('editor-tabs', ['Items', 'Layer', 'Preview'],
		z.array(z.enum(ParseArrayNotEmpty(TABS.map((t) => t[0])))),
	);
	const context = useMemo(() => ({ activeTabs, setActiveTabs }), [activeTabs, setActiveTabs]);

	return (
		<activeTabsContext.Provider value={ context }>
			<div className='editor'>
				{ activeTabs.map((tab, index) => <Tab tab={ tab } index={ index } key={ index } />) }
			</div>
		</activeTabsContext.Provider>
	);
}
