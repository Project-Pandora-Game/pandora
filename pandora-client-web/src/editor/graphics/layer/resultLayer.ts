import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { EditorLayer } from './editorLayer';
import dotTexture from '../../../assets/editor/dotTexture.png';

export class ResultLayer extends EditorLayer {
	private _wireFrame?: Graphics;
	private _allPoints?: Container;

	protected show(value: boolean): void {
		if (value) {
			if (!this._wireFrame) {
				this._wireFrame = this.makeWireFrame();
				this.character.addChild(this._wireFrame).zIndex = EditorLayer.Z_INDEX_EXTRA;
				this.character.sortChildren();
			} else {
				this._drawWireFrame(this._wireFrame);
			}
			if (!this._allPoints) {
				this._allPoints = this.makeAllPoints();
				this.character.addChild(this._allPoints).zIndex = EditorLayer.Z_INDEX_EXTRA + 1;
				this.character.sortChildren();
			} else {
				this._drawAllPoints(this._allPoints);
			}
		} else {
			if (this._wireFrame) {
				this.character.removeChild(this._wireFrame);
				this._wireFrame.destroy();
				this._wireFrame = undefined;
			}
			if (this._allPoints) {
				this.character.removeChild(this._allPoints);
				this._allPoints.destroy();
				this._allPoints = undefined;
			}
		}
	}

	private makeWireFrame(): Graphics {
		const wireframe = this._wireFrame = new Graphics();
		wireframe.x = this.x;
		wireframe.y = this.y;
		this._drawWireFrame(wireframe);
		return wireframe;
	}

	private _drawWireFrame(graphics: Graphics) {
		graphics.clear();

		graphics.lineStyle(1, 0x333333, 0.2);
		for (let i = 0; i < this.triangles.length; i += 3) {
			const poly = [0, 1, 2]
				.map((p) => this.triangles[i + p])
				.flatMap((p) => [this.vertices[2 * p], this.vertices[2 * p + 1]]);
			graphics.drawPolygon(poly);
		}
	}

	private makeAllPoints(): Container {
		const points = this._allPoints = new Container();
		points.x = this.x;
		points.y = this.y;
		this._drawAllPoints(points);
		return points;
	}

	private _drawAllPoints(container: Container) {
		container.removeChildren();

		const texture = Texture.from(dotTexture);

		const createPoint = (x: number, y: number) => {
			const point = new Sprite(texture);

			point.anchor.set(0.5);
			point.scale.set(0.5);
			point.alpha = 0.5;
			point.x = x;
			point.y = y;

			container.addChild(point);
		};

		const vertices = this.points
			.flatMap((point) => this.character.evalTransform(this.mirrorPoint(point.pos), point.transforms, point.mirror));

		for (let i = 0; i < vertices.length; i += 2) {
			createPoint(vertices[i], vertices[i + 1]);
		}
	}

	override destroy() {
		this.show(false);
		super.destroy();
	}
}
