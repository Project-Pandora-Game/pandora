import type { Immutable } from 'immer';
import { noop } from 'lodash-es';
import { Assert, AssertNotNullable, AssetFrameworkCharacterState, AssetFrameworkGlobalState, AssetFrameworkGlobalStateContainer, AssetFrameworkRoomState, AssetId, CharacterSize, GetLogger, HexColorString, ParseArrayNotEmpty, TypedEventEmitter, type GraphicsSourceLayer, type LayerStateOverrides } from 'pandora-common';
import { createContext, ReactElement, useContext, useMemo, useSyncExternalStore } from 'react';
import { z } from 'zod';
import { GetCurrentAssetManager } from '../assets/assetManager.tsx';
import { useBrowserStorage } from '../browserStorage.ts';
import { useEvent } from '../common/useEvent.ts';
import { Select } from '../common/userInteraction/select/select.tsx';
import { Button } from '../components/common/button/button.tsx';
import { LocalErrorBoundary } from '../components/error/localErrorBoundary.tsx';
import { Observable, useObservable } from '../observable.ts';
import { AssetManagerEditor, EditorAssetManager, useAssetManagerEditor } from './assets/assetManager.ts';
import type { EditorAssetGraphics } from './assets/editorAssetGraphics.ts';
import type { EditorAssetGraphicsLayer } from './assets/editorAssetGraphicsLayer.ts';
import { EditorAssetGraphicsManager } from './assets/editorAssetGraphicsManager.ts';
import { AssetUI } from './components/asset/asset.tsx';
import { AssetInfoUI } from './components/assetInfo/assetInfo.tsx';
import { AssetsUI } from './components/assets/assets.tsx';
import { BoneUI } from './components/bones/bones.tsx';
import { LayerUI } from './components/layer/layer.tsx';
import { PointsUI } from './components/points/points.tsx';
import { EditorWardrobeUI } from './components/wardrobe/wardrobe.tsx';
import './editor.scss';
import { useEditor } from './editorContextProvider.tsx';
import { EDITOR_CHARACTER_ID, EditorCharacter } from './graphics/character/appearanceEditor.ts';
import { EditorResultScene, EditorSetupScene } from './graphics/editorScene.tsx';
import type { PointTemplateEditor } from './graphics/pointTemplateEditor.tsx';

const logger = GetLogger('Editor');

export const EDITOR_ALPHAS = [1, 0.6, 0];
export const EDITOR_ALPHA_ICONS = ['⯀', '⬕', '⬚'];

export class Editor extends TypedEventEmitter<{
	layerOverrideChange: EditorAssetGraphicsLayer;
	globalStateChange: true;
}> {
	public readonly globalState: AssetFrameworkGlobalStateContainer;
	public readonly character: EditorCharacter;

	public readonly showBones = new Observable<boolean>(false);

	public readonly targetAsset = new Observable<EditorAssetGraphics | null>(null);
	public readonly targetLayer = new Observable<EditorAssetGraphicsLayer | null>(null);

	public readonly targetTemplate = new Observable<PointTemplateEditor | null>(null);

	public readonly backgroundColor = new Observable<HexColorString>('#1099bb');
	public readonly getCenter = new Observable<() => { x: number; y: number; }>(
		() => ({ x: CharacterSize.WIDTH / 2, y: CharacterSize.HEIGHT / 2 }),
	);

	constructor(assetManager: AssetManagerEditor) {
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

		const spaceState = AssetFrameworkRoomState.createDefault(assetManager, null);
		this.globalState = new AssetFrameworkGlobalStateContainer(
			logger.prefixMessages('[Asset framework state]'),
			() => {
				this.emit('globalStateChange', true);
			},
			AssetFrameworkGlobalState
				.createDefault(assetManager, spaceState)
				.withCharacter(
					EDITOR_CHARACTER_ID,
					AssetFrameworkCharacterState
						.createDefault(assetManager, EDITOR_CHARACTER_ID, spaceState)
						.produceWithRestrictionOverride({ type: 'safemode', allowLeaveAt: 0 }),
				)
				.runAutomaticActions(),
		);

		this.character = new EditorCharacter(this);

		EditorAssetManager.on('assetMangedChanged', (newAssetManager) => {
			this.globalState.reloadAssetManager(newAssetManager);
		});

		// Prevent loosing progress
		window.addEventListener('beforeunload', (event) => {
			if (EditorAssetGraphicsManager.editedAssetGraphics.value.size > 0) {
				event.preventDefault();
				// eslint-disable-next-line @typescript-eslint/no-deprecated
				return event.returnValue = 'Are you sure you want to exit?';
			}
			return undefined;
		}, { capture: true });
	}

	private readonly layerStateOverrides = new WeakMap<EditorAssetGraphicsLayer, LayerStateOverrides>();

	public getLayerStateOverride(layer: EditorAssetGraphicsLayer): LayerStateOverrides | undefined {
		return this.layerStateOverrides.get(layer);
	}

	public setLayerStateOverride(layer: EditorAssetGraphicsLayer, override: LayerStateOverrides | undefined): void {
		if (override) {
			this.layerStateOverrides.set(layer, override);
		} else {
			this.layerStateOverrides.delete(layer);
		}
		this.emit('layerOverrideChange', layer);
	}

	public getLayersAlphaOverrideIndex(...layers: EditorAssetGraphicsLayer[]): number {
		return layers.reduce<number | undefined>((prev, layer) => {
			const alpha = this.getLayerStateOverride(layer)?.alpha ?? 1;
			const index = EDITOR_ALPHAS.indexOf(alpha);
			if (index >= 0 && (prev === undefined || index < prev))
				return index;
			return prev;
		}, undefined) ?? 0;
	}

	public setLayerAlphaOverride(layers: readonly EditorAssetGraphicsLayer[], index: number): void {
		const newAlpha = EDITOR_ALPHAS[index % EDITOR_ALPHAS.length];
		for (const layer of layers) {
			this.setLayerStateOverride(layer, {
				...this.getLayerStateOverride(layer),
				alpha: newAlpha,
			});
		}
	}

	public setLayerTint(layer: EditorAssetGraphicsLayer, tint: number | undefined): void {
		this.setLayerStateOverride(layer, {
			...this.getLayerStateOverride(layer),
			color: tint,
		});
	}

	public startEditAsset(asset: AssetId): void {
		const newEdit = !EditorAssetGraphicsManager.editedAssetGraphics.value.has(asset);
		const graphics = EditorAssetGraphicsManager.startEditAsset(asset);

		// Wear this asset if not currently wearing it (but only if starting edit for the first time)
		if (newEdit) {
			if (this.character.getAppearance().listItemsByAsset(asset).length === 0) {
				const actualAsset = GetCurrentAssetManager().getAssetById(asset);
				AssertNotNullable(actualAsset);
				this.character.getAppearance().addItem(actualAsset);
			}
		}

		this.targetAsset.value = graphics;
	}

	public discardAssetEdits(asset: AssetId): void {
		if (this.targetAsset.value?.id === asset) {
			this.targetAsset.value = null;
		}

		EditorAssetGraphicsManager.discardAssetEdits(asset);
	}

	public setBackgroundColor(color: HexColorString): void {
		this.backgroundColor.value = color;
		document.documentElement.style.setProperty('--editor-background-color', color);
	}
}

export function useEditorLayerStateOverride(layer: EditorAssetGraphicsLayer): LayerStateOverrides | undefined {
	const editor = useEditor();
	return useSyncExternalStore((changed) => {
		return editor.on('layerOverrideChange', (changedLayer) => {
			if (changedLayer === layer) {
				changed();
			}
		});
	}, () => editor.getLayerStateOverride(layer));
}

export function useEditorLayerTint(layer: EditorAssetGraphicsLayer): number {
	const override = useEditorLayerStateOverride(layer);
	const layerDefinition = useObservable<Immutable<GraphicsSourceLayer>>(layer.definition);
	const asset = useAssetManagerEditor().getAssetById(layer.asset.id);
	if (override?.color !== undefined) {
		return override.color;
	}
	if (asset != null && (asset.isType('bodypart') || asset.isType('personal'))) {
		const { colorization } = asset.definition;
		if (colorization && layerDefinition.type === 'mesh' && layerDefinition.colorizationKey) {
			const value = colorization[layerDefinition.colorizationKey];
			if (value) {
				return parseInt(value.default.substring(1), 16);
			}
		}
	}
	return 0xffffff;
}

const TABS = [
	['Wardrobe', 'editor-ui', EditorWardrobeUI],
	['Pose', 'editor-ui', BoneUI],
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
