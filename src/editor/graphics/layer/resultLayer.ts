import { Container, Sprite, Texture } from 'pixi.js';
import { EditorLayer } from './editorLayer';
import dotTexture from '../../../assets/editor/dotTexture.png';

export class ResultLayer extends EditorLayer {
	private _allPoints?: Container;

	protected override calculateVertices(): boolean {
		super.calculateVertices();
		if (this._allPoints) {
			this._drawAllPoints(this._allPoints);
		}
		return true;
	}

	protected show(value: boolean): void {
		if (value) {
			if (!this._allPoints) {
				this._allPoints = this.makeAllPoints();
				this.character.addChild(this._allPoints).zIndex = EditorLayer.Z_INDEX_EXTRA;
				this.character.sortChildren();
			}
		} else if (this._allPoints) {
			this.character.removeChild(this._allPoints);
			this._allPoints.destroy();
			this._allPoints = undefined;
		}
	}

	protected makeAllPoints(): Container {
		const points = new Container();
		points.x = this.x;
		points.y = this.y;
		this._drawAllPoints(points);
		return points;
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

	override destroy() {
		this.show(false);
		super.destroy();
	}
}
