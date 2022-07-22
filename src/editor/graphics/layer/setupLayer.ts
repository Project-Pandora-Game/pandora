import { Graphics, Container, Sprite } from 'pixi.js';
import { DraggablePoint } from '../draggable';
import { EditorLayer } from './editorLayer';
import { BoneName } from 'pandora-common';

export class SetupLayer extends EditorLayer {
	private _wireFrame?: Graphics;

	protected override calculateVertices(normalize: boolean = false, valueOverrides?: Record<BoneName, number>): Float64Array {
		return super.calculateVertices(normalize, valueOverrides ?? {});
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
			} else {
				this._drawWireFrame(this._wireFrame);
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
		const wireframe = (this._wireFrame ??= new Graphics());
		wireframe.x = this.x;
		wireframe.y = this.y;
		this._drawWireFrame(wireframe);
		return wireframe;
	}

	private _drawWireFrame(graphics: Graphics) {
		graphics.clear();

		graphics.lineStyle(1, 0x333333, 0.2);
		const h = this.layer.definition.height;
		const w = this.layer.definition.width;
		for (let i = 0; i < this.triangles.length; i += 3) {
			const poly = [0, 1, 2]
				.map((p) => this.triangles[i + p])
				.flatMap((p) => [this.uv[2 * p] * w, this.uv[2 * p + 1] * h]);
			graphics.drawPolygon(poly);
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
			const shouldClear = editor.targetPoint.value && this._draggablePoints.includes(editor.targetPoint.value);
			this._draggablePoints = [];
			// Only clear the point after doing all cleanup, as it will trigger update
			if (shouldClear) {
				editor.targetPoint.value = null;
			}
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
		// Don't create the points if they exist after `removeAllPoints`
		// it might actually not remove the points, because it can cause update which recreates them
		if (this._allPoints)
			return;
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
