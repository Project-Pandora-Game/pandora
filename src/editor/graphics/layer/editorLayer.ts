import { AssetGraphicsLayer } from '../../../assets/assetGraphics';
import { LayerStateOverrides } from '../../../graphics/def';
import { GraphicsLayer } from '../../../graphics/graphicsLayer';
import { GraphicsCharacterEditor } from '../character/editorCharacter';

export abstract class EditorLayer extends GraphicsLayer<GraphicsCharacterEditor> {
	// eslint-disable-next-line @typescript-eslint/naming-convention
	protected static readonly Z_INDEX_EXTRA = 10000;

	private readonly _cleanups: (() => void)[] = [];

	constructor(layer: AssetGraphicsLayer, character: GraphicsCharacterEditor) {
		super(layer, character);
		this._cleanups.push(this.layer.on('change', this._pointUpdate.bind(this)));
		this._cleanups.push(this.character.editor.targetLayer.subscribe(() => this.update({})));
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
