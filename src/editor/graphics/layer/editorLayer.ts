import { GraphicsLayer, GraphicsLayerProps } from '../../../graphics/graphicsLayer';
import { ObservableLayer } from '../observable/observableLayer';
import { EditorCharacter } from '../character/editorCharacter';

export abstract class EditorLayer extends GraphicsLayer {
	protected readonly observableLayer: ObservableLayer;
	protected readonly editorCharacter: EditorCharacter;

	protected constructor(props: GraphicsLayerProps) {
		super(props);
		this.observableLayer = props.layer as ObservableLayer;
		this.observableLayer.on('points', this._pointUpdate.bind(this));
		this.editorCharacter = props.character as EditorCharacter;

		this.observableLayer.on('selected', (selected: boolean) => this.show(selected));
		if (this.observableLayer.selected) {
			this.show(true);
		}
	}

	protected abstract show(value: boolean): void;

	private _pointUpdate(): void {
		this.calculateTriangles();
		this.update({ force: true });
	}
}
