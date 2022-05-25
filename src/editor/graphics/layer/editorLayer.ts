import { GraphicsLayer, GraphicsLayerProps } from '../../../graphics/graphicsLayer';
import { GraphicsCharacterEditor } from '../character/editorCharacter';

export abstract class EditorLayer extends GraphicsLayer {
	// eslint-disable-next-line @typescript-eslint/naming-convention
	protected static readonly Z_INDEX_EXTRA = 10000;

	private readonly _cleanups: (() => void)[] = [];

	protected readonly editorCharacter: GraphicsCharacterEditor;

	protected constructor(props: GraphicsLayerProps) {
		super(props);
		this._cleanups.push(this.layer.on('change', this._pointUpdate.bind(this)));
		this.editorCharacter = props.character as GraphicsCharacterEditor;
	}

	protected abstract show(value: boolean): void;

	private _pointUpdate(): void {
		this.calculateTriangles();
		this.update({ force: true });
	}

	override destroy(): void {
		this._cleanups.forEach((cleanup) => cleanup());
		super.destroy();
	}
}
