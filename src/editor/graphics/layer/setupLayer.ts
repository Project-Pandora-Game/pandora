import type { PointDefinition } from 'pandora-common/dist/assets';
import { Graphics, Container, Texture } from 'pixi.js';
import { Draggable } from '../draggable';
import { EditorLayer } from './editorLayer';
import dotTexture from '../../../assets/editor/dotTexture.png';

export class SetupLayer extends EditorLayer {
	private _wireFrame?: Graphics;
	private _allPoints?: Container;
	private _allPointsCleanup: (() => void)[] = [];

	protected override calculateVertices(): boolean {
		this.vertices = new Float64Array(this.points
			.flatMap((point) => this.mirrorPoint(point.pos)));

		return true;
	}

	protected override _calculatePoints() {
		super._calculatePoints();
		if (this._wireFrame) {
			this._drawWireFrame(this._wireFrame);
		}
	}

	protected show(value: boolean): void {
		if (value) {
			if (!this._wireFrame) {
				this._wireFrame = this.makeWireFrame();
				this.character.addChild(this._wireFrame).zIndex = EditorLayer.Z_INDEX_EXTRA;
				this.character.sortChildren();
			}
			if (!this._allPoints) {
				this._allPoints = this.makeAllPoints();
				this.character.addChild(this._allPoints).zIndex = EditorLayer.Z_INDEX_EXTRA;
				this.character.sortChildren();
			}
		} else {
			if (this._wireFrame) {
				this.character.removeChild(this._wireFrame);
				this._wireFrame.destroy();
				this._wireFrame = undefined;
			}
			if (this._allPoints) {
				this.character.removeChild(this._allPoints);
				this._allPointsCleanup.forEach((cleanup) => cleanup());
				this._allPointsCleanup = [];
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
		graphics.lineStyle(2, 0x333333, 0.3);
		const coords = this.points.map((point) => point.pos);
		for (let i = 0; i < this.triangles.length; i += 3) {
			const poly = [0, 1, 2].map((p) => coords[this.triangles[i + p]]);
			graphics.drawPolygon(poly.flat());
		}
	}

	private makeAllPoints(): Container {
		const container = new Container();

		const createDraggable = (point: PointDefinition, _index: number) => {
			const draggable = new Draggable({
				createTexture: () => Texture.from(dotTexture),
				setPos: (_, x, y) => {
					point.pos = [x, y];
					// point.updatePair(['pos']);
					this.layer.buildPoints();
				},
			});

			draggable.x = point.pos[0];
			draggable.y = point.pos[1];
			// if (point.isMirrored()) {
			// 	draggable.tint = 0x00ff00;
			// }

			container.addChild(draggable);

			return draggable;
		};

		const dots = this.points.map(createDraggable);

		this._allPointsCleanup.push(this.layer.on('change', () => {
			const points = this.points;
			if (points.length < dots.length) {
				for (let i = dots.length - 1; i >= points.length; i--) {
					container.removeChild(dots[i]);
					dots[i].destroy();
				}
				dots.splice(points.length);
			}
			for (let i = 0; i < points.length; i++) {
				dots[i].x = points[i].pos[0];
				dots[i].y = points[i].pos[1];
			}
			if (points.length > dots.length) {
				for (let i = dots.length; i < points.length; i++) {
					dots.push(createDraggable(points[i], i));
				}
			}
		}));

		return container;
	}

	override destroy() {
		this.show(false);
		super.destroy();
	}
}
