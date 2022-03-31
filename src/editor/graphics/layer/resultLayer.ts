import type { GraphicsLayerProps } from '../../../graphics/graphicsLayer';
import { Container, Sprite, Texture } from 'pixi.js';
import { EditorLayer } from './editorLayer';
import dotTexture from '../../../assets/editor/dotTexture.png';

export class ResultLayer extends EditorLayer {
	private _points?: Container;
	protected get points(): Container {
		if (!this._points) {
			const points = this._points = new Container();
			points.x = this.x;
			points.y = this.y;
			this._drawPoints(points);
			points.on('destroy', () => this._points = undefined);
		}
		return this._points;
	}

	protected constructor(props: GraphicsLayerProps) {
		super(props);
	}

	public static override create = (props: GraphicsLayerProps) => new ResultLayer(props);

	protected override calculateVertices(): boolean {
		super.calculateVertices();
		if (this._points) {
			this._drawPoints(this._points);
		}
		return true;
	}

	protected show(value: boolean): void {
		if (value) {
			this.editorCharacter.addChild(this.points);
		} else {
			this.editorCharacter.removeChild(this.points);
			this.points.destroy();
		}
	}

	private _drawPoints(container: Container) {
		container.removeChildren();

		const createPoint = (x: number, y: number) => {
			const point = new Sprite(Texture.from(dotTexture));

			point.x = x;
			point.y = y;
			point.anchor.set(0.5);
			point.scale.set(0.5);
			point.alpha = 0.8;

			container.addChild(point);
		};

		for (let i = 0; i < this.vertices.length; i += 2) {
			createPoint(this.vertices[i], this.vertices[i + 1]);
		}
	}
}
