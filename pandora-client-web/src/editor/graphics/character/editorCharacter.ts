import { AbstractRenderer, Container } from 'pixi.js';
import { AssetGraphicsLayer } from '../../../assets/assetGraphics';
import { LayerState } from '../../../graphics/def';
import { GraphicsCharacter } from '../../../graphics/graphicsCharacter';
import { Editor } from '../../editor';
import { EditorLayer } from '../layer/editorLayer';
import { EditorCharacter } from './appearanceEditor';

export class GraphicsCharacterEditor extends GraphicsCharacter<EditorCharacter> {
	protected readonly boneLayer = new Container;
	readonly editor: Editor;

	protected constructor(editor: Editor, renderer: AbstractRenderer) {
		super(editor.character, renderer);
		this.editor = editor;
		this.addChild(this.boneLayer).zIndex = EditorLayer.Z_INDEX_EXTRA + 1;
		this.cleanupCalls.push(
			editor.showBones.subscribe((show) => {
				this.boneLayer.visible = show;
			}),
		);
		this.boneLayer.visible = editor.showBones.value;
		this.cleanupCalls.push(
			editor.on('layerOverrideChange', (layer) => {
				if (this._activeLayers.has(layer)) {
					this.update(['items']);
				}
			}),
		);
		this.cleanupCalls.push(
			editor.on('modifiedAssetsChange', () => {
				this.update(['items']);
			}),
		);
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
