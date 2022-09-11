import { Item } from 'pandora-common';
import { Texture } from 'pixi.js';
import { AssetGraphicsLayer } from '../../../assets/assetGraphics';
import { LayerStateOverrides } from '../../../graphics/def';
import { GraphicsLayer } from '../../../graphics/graphicsLayer';
import { EditorAssetGraphics } from '../character/appearanceEditor';
import { GraphicsCharacterEditor } from '../character/editorCharacter';

export abstract class EditorLayer extends GraphicsLayer<GraphicsCharacterEditor> {
	// eslint-disable-next-line @typescript-eslint/naming-convention
	public static readonly Z_INDEX_EXTRA = 10000;

	private readonly _cleanups: (() => void)[] = [];

	constructor(layer: AssetGraphicsLayer, character: GraphicsCharacterEditor, item: Item | null) {
		super(layer, character, item);
		this._cleanups.push(this.layer.on('change', this._pointUpdate.bind(this)));
		this._cleanups.push(this.character.editor.targetLayer.subscribe(() => this.update({})));
		this._cleanups.push(this.character.editor.targetPoint.subscribe(() => this.update({})));
	}

	protected override getTexture(image: string): Promise<Texture> {
		return this.layer.asset instanceof EditorAssetGraphics ? this.layer.asset.getTexture(image) : super.getTexture(image);
	}

	protected abstract show(value: boolean): void;

	public override update(updateData: { bones?: Set<string> | undefined; state?: LayerStateOverrides | undefined; force?: boolean | undefined; }): void {
		super.update(updateData);
		this.show(this.character.editor.targetLayer.value === this.layer);
	}

	private _pointUpdate(): void {
		this._calculatePoints();
		this.update({ force: true });
	}

	override destroy(): void {
		this._cleanups.forEach((cleanup) => cleanup());
		super.destroy();
	}
}
