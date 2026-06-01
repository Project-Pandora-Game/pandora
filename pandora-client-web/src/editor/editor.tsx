import type { Immutable } from 'immer';
import { AbortActionAttempt, AppearanceActionProcessingContext, ApplyAction, AssetFrameworkCharacterState, AssetFrameworkGlobalState, AssetFrameworkGlobalStateContainer, AssetFrameworkSpaceState, AssetId, CharacterSize, EMPTY_ARRAY, FinishActionAttempt, GetLogger, HexColorString, StartActionAttempt, TypedEventEmitter, type ActionSpaceContext, type AppearanceAction, type AppearanceActionContext, type Asset, type IClientShardNormalResult, type LayerStateOverrides } from 'pandora-common';
import { useCallback, useSyncExternalStore } from 'react';
import { Observable, useObservable } from '../observable.ts';
import { AssetManagerEditor, EditorAssetManager, useAssetManagerEditor } from './assets/assetManager.ts';
import { EditorAssetGraphicsManager } from './assets/editorAssetGraphicsManager.ts';
import { type EditorAssetGraphicsRoomDeviceLayer } from './assets/editorAssetGraphicsRoomDeviceLayer.ts';
import { type EditorAssetGraphicsWornLayer } from './assets/editorAssetGraphicsWornLayer.ts';
import type { EditorAssetGraphics } from './assets/graphics/editorAssetGraphics.ts';
import './editor.scss';
import { useEditor } from './editorContextProvider.tsx';
import { EDITOR_CHARACTER_ID, EditorCharacter } from './graphics/character/appearanceEditor.ts';
import type { PointTemplateEditor } from './graphics/pointTemplateEditor.tsx';

const logger = GetLogger('Editor');

export const EDITOR_ALPHAS = [1, 0.6, 0];
export const EDITOR_ALPHA_ICONS = ['■', '⬕', '⬚'];

export class Editor extends TypedEventEmitter<{
	layerOverrideChange: EditorAssetGraphicsWornLayer | EditorAssetGraphicsRoomDeviceLayer;
	globalStateChange: true;
}> {
	public readonly created = Date.now();

	public readonly globalState: AssetFrameworkGlobalStateContainer;
	public readonly character: EditorCharacter;

	public readonly showBones = new Observable<boolean>(false);

	public readonly targetAsset = new Observable<EditorAssetGraphics | null>(null);
	public readonly targetLayer = new Observable<EditorAssetGraphicsWornLayer | EditorAssetGraphicsRoomDeviceLayer | null>(null);

	public readonly targetTemplate = new Observable<PointTemplateEditor | null>(null);

	public readonly backgroundColor = new Observable<HexColorString>('#1099bb');
	public readonly getCenter = new Observable<() => { x: number; y: number; }>(
		() => ({ x: CharacterSize.WIDTH / 2, y: CharacterSize.HEIGHT / 2 }),
	);

	constructor(assetManager: AssetManagerEditor) {
		super();

		this.targetAsset.subscribe((asset) => {
			if (this.targetLayer.value?.assetGraphics !== asset) {
				this.targetLayer.value = null;
			}
		});

		this.targetLayer.subscribe((layer) => {
			if (layer && this.targetAsset.value !== layer.assetGraphics) {
				logger.error('Set target layer with non-matching target asset', layer, this.targetAsset.value);
				this.targetLayer.value = null;
				layer = null;
			}
		});

		const spaceState = AssetFrameworkSpaceState.createDefault(assetManager, null);
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

	private readonly layerStateOverrides = new WeakMap<EditorAssetGraphicsWornLayer | EditorAssetGraphicsRoomDeviceLayer, LayerStateOverrides>();

	public getLayerStateOverride(layer: EditorAssetGraphicsWornLayer | EditorAssetGraphicsRoomDeviceLayer): LayerStateOverrides | undefined {
		return this.layerStateOverrides.get(layer);
	}

	public setLayerStateOverride(layer: EditorAssetGraphicsWornLayer | EditorAssetGraphicsRoomDeviceLayer, override: LayerStateOverrides | undefined): void {
		if (override) {
			this.layerStateOverrides.set(layer, override);
		} else {
			this.layerStateOverrides.delete(layer);
		}
		this.emit('layerOverrideChange', layer);
	}

	public getLayersAlphaOverrideIndex(...layers: (EditorAssetGraphicsWornLayer | EditorAssetGraphicsRoomDeviceLayer)[]): number {
		return layers.reduce<number | undefined>((prev, layer) => {
			const alpha = this.getLayerStateOverride(layer)?.alpha ?? 1;
			const index = EDITOR_ALPHAS.indexOf(alpha);
			if (index >= 0 && (prev === undefined || index < prev))
				return index;
			return prev;
		}, undefined) ?? 0;
	}

	public setLayerAlphaOverride(layers: readonly (EditorAssetGraphicsWornLayer | EditorAssetGraphicsRoomDeviceLayer)[], index: number): void {
		const newAlpha = EDITOR_ALPHAS[index % EDITOR_ALPHAS.length];
		for (const layer of layers) {
			this.setLayerStateOverride(layer, {
				...this.getLayerStateOverride(layer),
				alpha: newAlpha,
			});
		}
	}

	public setLayerTint(layer: EditorAssetGraphicsWornLayer | EditorAssetGraphicsRoomDeviceLayer, tint: number | undefined): void {
		this.setLayerStateOverride(layer, {
			...this.getLayerStateOverride(layer),
			color: tint,
		});
	}

	public startEditAsset(asset: Asset): void {
		const newEdit = !EditorAssetGraphicsManager.editedAssetGraphics.value.has(asset.id);
		const graphics = EditorAssetGraphicsManager.startEditAsset(asset);

		// Wear this asset if not currently wearing it (but only if starting edit for the first time)
		if (newEdit) {
			if (this.character.getAppearance().listItemsByAsset(asset.id).length === 0) {
				if (asset.canBeSpawned() && asset.isWearable()) {
					this.character.getAppearance().addItem(asset);
				}
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

	public doImmediateAction(action: Immutable<AppearanceAction>): IClientShardNormalResult['gameLogicAction'] {
		// We do direct apply to skip need for attempt in some edge cases.
		const processingContext = new AppearanceActionProcessingContext(this.getAppearanceActionContext('act'), this.globalState.currentState);
		const result = ApplyAction(processingContext, action);

		// Check if result is valid
		if (!result.valid) {
			return {
				result: 'failure',
				problems: result.problems.slice(),
			};
		}

		// Apply the action
		this.globalState.setState(result.resultState);

		return {
			result: 'success',
			data: result.actionData,
		};
	}

	public startActionAttempt(action: Immutable<AppearanceAction>): IClientShardNormalResult['gameLogicAction'] {
		const result = StartActionAttempt(action, this.getAppearanceActionContext('act'), this.globalState.currentState, Date.now());

		// Check if result is valid
		if (!result.valid) {
			return {
				result: 'failure',
				problems: result.problems.slice(),
			};
		}

		// Apply the action
		this.globalState.setState(result.resultState);

		return {
			result: 'success',
			data: result.actionData,
		};
	}

	public completeCurrentActionAttempt(): IClientShardNormalResult['gameLogicAction'] {
		const result = FinishActionAttempt(this.getAppearanceActionContext('act'), this.globalState.currentState, Date.now());

		// Check if result is valid
		if (!result.valid) {
			return {
				result: 'failure',
				problems: result.problems.slice(),
			};
		}

		// Apply the action
		this.globalState.setState(result.resultState);

		return {
			result: 'success',
			data: result.actionData,
		};
	}

	public abortCurrentActionAttempt(): IClientShardNormalResult['gameLogicAction'] {
		const result = AbortActionAttempt(this.getAppearanceActionContext('act'), this.globalState.currentState);

		// Check if result is valid
		if (!result.valid) {
			return {
				result: 'failure',
				problems: result.problems.slice(),
			};
		}

		// Apply the action
		this.globalState.setState(result.resultState);

		return {
			result: 'success',
			data: result.actionData,
		};
	}

	public getCurrentSpaceContext(): ActionSpaceContext {
		return {
			features: [
				'development',
				'allowBodyChanges',
			],
			getAccountSpaceRole: () => 'owner',
			development: {
				autoAdmin: true,
				disableSafemodeCooldown: true,
			},
			// Editor has no character modifiers
			getCharacterModifierEffects: () => EMPTY_ARRAY,
		};
	}

	public getAppearanceActionContext(executionContext: AppearanceActionContext['executionContext']): AppearanceActionContext {
		return {
			executionContext,
			player: this.character.gameLogicCharacter,
			spaceContext: this.getCurrentSpaceContext(),
			getCharacter: (id) => {
				if (id === this.character.id) {
					return this.character.gameLogicCharacter;
				}
				return null;
			},
		};
	}
}

export function useEditorLayerStateOverride(layer: EditorAssetGraphicsWornLayer | EditorAssetGraphicsRoomDeviceLayer): LayerStateOverrides | undefined {
	const editor = useEditor();
	return useSyncExternalStore(
		useCallback((changed) => {
			return editor.on('layerOverrideChange', (changedLayer) => {
				if (changedLayer === layer) {
					changed();
				}
			});
		}, [editor, layer]),
		useCallback(() => editor.getLayerStateOverride(layer), [editor, layer]),
	);
}

export function useEditorLayerTint(layer: EditorAssetGraphicsWornLayer | EditorAssetGraphicsRoomDeviceLayer): number {
	const override = useEditorLayerStateOverride(layer);
	const layerDefinition = useObservable(layer.definition);
	const asset = useAssetManagerEditor().getAssetById(layer.assetGraphics.id);
	if (override?.color !== undefined) {
		return override.color;
	}
	if (asset != null && (asset.isType('bodypart') || asset.isType('personal') || asset.isType('roomDevice'))) {
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
