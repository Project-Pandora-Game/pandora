import { AbstractRenderer, Container } from 'pixi.js';
import { AssetGraphicsLayer } from '../../../assets/assetGraphics';
import { GetAssetManager } from '../../../assets/assetManager';
import { AppearanceContainer, AppearanceEvents } from '../../../character/character';
import { TypedEventEmitter } from '../../../event';
import { LayerState } from '../../../graphics/def';
import { GraphicsCharacter } from '../../../graphics/graphicsCharacter';
import { Editor } from '../../editor';
import { EditorLayer } from '../layer/editorLayer';
import { AppearanceEditor } from './appearanceEditor';

export class EditorCharacter extends TypedEventEmitter<AppearanceEvents> implements AppearanceContainer {
	appearance: AppearanceEditor;

	constructor() {
		super();
		this.appearance = new AppearanceEditor(GetAssetManager(), (changes) => this.emit('appearanceUpdate', changes));
	}
}

export class GraphicsCharacterEditor extends GraphicsCharacter<EditorCharacter> {
	protected readonly boneLayer = new Container;
	readonly editor: Editor;

	protected constructor(editor: Editor, renderer: AbstractRenderer) {
		super(editor.character, renderer);
		this.editor = editor;
		this.addChild(this.boneLayer).zIndex = EditorLayer.Z_INDEX_EXTRA + 1;
		const cleanup: (() => void)[] = [];
		cleanup.push(editor.showBones.subscribe((show) => {
			this.boneLayer.visible = show;
		}));
		this.boneLayer.visible = editor.showBones.value;
		cleanup.push(editor.on('layerOverrideChange', (layer) => {
			if (this._activeLayers.has(layer)) {
				this.update(['items']);
			}
		}));
		cleanup.push(editor.on('modifiedAssetsChange', () => {
			this.update(['items']);
		}));
		this.on('destroy', () => cleanup.forEach((c) => c()));
	}

	private readonly _activeLayers = new Set<AssetGraphicsLayer>();

	protected override buildLayers(): LayerState[] {
		this._activeLayers.clear();
		const result: LayerState[] = super.buildLayers();
		for (const layer of result) {
			this._activeLayers.add(layer.layer);
			const overrides = this.editor.getLayerStateOverride(layer.layer);
			if (overrides) {
				layer.state = { ...layer.state, ...overrides };
			}
		}
		return result;
	}
}
