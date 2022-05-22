import { GraphicsLayer, GraphicsLayerProps } from '../../../graphics/graphicsLayer';
import { ObservableLayer } from '../observable/observableLayer';
import { EditorCharacter } from '../character/editorCharacter';

export abstract class EditorLayer extends GraphicsLayer {
	// eslint-disable-next-line @typescript-eslint/naming-convention
	protected static readonly Z_INDEX_EXTRA = 10000;

	private readonly _cleanups: (() => void)[] = [];

	protected readonly observableLayer: ObservableLayer;
	protected readonly editorCharacter: EditorCharacter;

	protected constructor(props: GraphicsLayerProps) {
		super(props);
		this.observableLayer = props.layer as ObservableLayer;
		this._cleanups.push(this.observableLayer.on('points', this._pointUpdate.bind(this)));
		this.editorCharacter = props.character as EditorCharacter;

		this._cleanups.push(this.observableLayer.on('selected', (selected: boolean) => this.show(selected)));
		if (this.observableLayer.selected) {
			this.show(true);
		}
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
