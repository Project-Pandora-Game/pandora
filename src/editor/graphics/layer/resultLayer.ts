import type { GraphicsLayerProps } from '../../../graphics/graphicsLayer';
import { Container, Sprite, Texture } from 'pixi.js';
import { EditorLayer } from './editorLayer';
import dotTexture from '../../../assets/editor/dotTexture.png';

export class ResultLayer extends EditorLayer {
	private _allPoints?: Container;
	protected get allPoints(): Container {
		if (!this._allPoints) {
			const points = this._allPoints = new Container();
			points.x = this.x;
			points.y = this.y;
			this._drawAllPoints(points);
			points.on('destroy', () => this._allPoints = undefined);
		}
		return this._allPoints;
	}

	protected constructor(props: GraphicsLayerProps) {
		super(props);
	}

	public static override create = (props: GraphicsLayerProps) => new ResultLayer(props);

	protected override calculateVertices(): boolean {
		super.calculateVertices();
		if (this._allPoints) {
			this._drawAllPoints(this._allPoints);
		}
		return true;
	}

	protected show(value: boolean): void {
		if (value) {
			this.editorCharacter.addChild(this.allPoints);
		} else {
			this.editorCharacter.removeChild(this.allPoints);
			this.allPoints.destroy();
		}
	}

	private _drawAllPoints(container: Container) {
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
