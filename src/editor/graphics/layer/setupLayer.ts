import { Graphics, Container, Sprite } from 'pixi.js';
import { DraggablePoint } from '../draggable';
import { EditorLayer } from './editorLayer';
import Delaunator from 'delaunator';
import { SelectPoints } from '../../../graphics/graphicsLayer';

export class SetupLayer extends EditorLayer {
	private _wireFrame?: Graphics;

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
		if (this._allPoints) {
			this.updateAllPoints();
		}
	}

	private _showSprite: boolean = false;
	protected show(value: boolean): void {
		if (value !== this._showSprite) {
			this._showSprite = value;
			this.update({ force: true });
		}
		if (value) {
			if (!this._wireFrame) {
				this._wireFrame = this.makeWireFrame();
				this.character.addChild(this._wireFrame).zIndex = EditorLayer.Z_INDEX_EXTRA;
				this.character.sortChildren();
			}
			this.updateAllPoints();
		} else {
			if (this._wireFrame) {
				this.character.removeChild(this._wireFrame);
				this._wireFrame.destroy();
				this._wireFrame = undefined;
			}
			this.removeAllPoints();
		}
	}

	protected override updateChild(): void {
		if (this._showSprite) {
			this.result = new Sprite(this.texture);
		} else {
			super.updateChild();
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

		const coords = this.points.map((point) => point.pos);
		graphics.lineStyle(1, 0x555555, 0.1);

		const delaunator = new Delaunator(this.points.flatMap((point) => point.pos));
		const triangles: number[] = [];
		for (let i = 0; i < delaunator.triangles.length; i += 3) {
			const t = [i, i + 1, i + 2].map((tp) => delaunator.triangles[tp]);
			graphics.drawPolygon(t.flatMap((p) => coords[p]));
			if (t.every((tp) => SelectPoints(this.points[tp], this.layer.definition.pointType, this.layer.side))) {
				triangles.push(...t);
			}
		}

		graphics.lineStyle(2, 0x333333, 0.3);
		for (let i = 0; i < triangles.length; i += 3) {
			const poly = [0, 1, 2].map((p) => coords[triangles[i + p]]);
			graphics.drawPolygon(poly.flat());
		}
	}

	private _allPoints?: Container;
	private _draggablePoints: DraggablePoint[] = [];

	private removeAllPoints(): void {
		if (this._allPoints) {
			this.character.removeChild(this._allPoints);
			this._allPoints.destroy();
			this._allPoints = undefined;
			const editor = this.character.editor;
			if (editor.targetPoint.value && this._draggablePoints.includes(editor.targetPoint.value)) {
				editor.targetPoint.value = null;
			}
			this._draggablePoints = [];
		}
	}

	private updateAllPoints(): void {
		const targetPoint = this.character.editor.targetPoint.value;
		if (this._allPoints && this._draggablePoints.length === this.points.length) {
			for (let i = 0; i < this.points.length; i++) {
				this._draggablePoints[i].updatePoint(this.points[i], this._draggablePoints[i] === targetPoint);
			}
			return;
		}

		this.removeAllPoints();
		this._allPoints = new Container();

		this._draggablePoints = this.points.map((definition) => {
			const point = new DraggablePoint(this.character.editor, this.layer, definition);
			this._allPoints?.addChild(point.draggable);
			return point;
		});

		this.character.addChild(this._allPoints).zIndex = EditorLayer.Z_INDEX_EXTRA;
		this.character.sortChildren();
	}

	override destroy() {
		this.show(false);
		super.destroy();
	}
}
