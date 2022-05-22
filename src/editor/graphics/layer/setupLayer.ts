import type { PointDefinition } from 'pandora-common/dist/assets';
import type { GraphicsLayerProps } from '../../../graphics/graphicsLayer';
import { Graphics, Container, Texture } from 'pixi.js';
import { Draggable } from '../draggable';
import { EditorLayer } from './editorLayer';
import dotTexture from '../../../assets/editor/dotTexture.png';
import { MirrorPointDefinition } from '../editorStore';

export class SetupLayer extends EditorLayer {
	private _wireFrame?: Graphics;
	private _allPoints?: Container;

	private get wireFrame(): Graphics {
		if (!this._wireFrame) {
			const wireframe = this._wireFrame = new Graphics();
			wireframe.x = this.x;
			wireframe.y = this.y;
			this._drawWireFrame(wireframe);
		}
		return this._wireFrame;
	}

	private get allPoints(): Container {
		if (!this._allPoints) {
			this._allPoints = new Container();
			this._drawAllPoints(this._allPoints);
		}
		return this._allPoints;
	}

	protected constructor(props: GraphicsLayerProps) {
		super(props);
	}

	public static override create = (props: GraphicsLayerProps) => new SetupLayer(props);

	protected override calculateVertices(): boolean {
		this.vertices = new Float64Array(this.points
			.flatMap((point) => this.mirrorPoint(point.pos)));

		return true;
	}

	protected override calculateTriangles() {
		super.calculateTriangles();
		if (this._wireFrame) {
			this._drawWireFrame(this._wireFrame);
		}
	}

	protected show(value: boolean): void {
		if (value) {
			this.editorCharacter.addChild(this.wireFrame).zIndex = EditorLayer.Z_INDEX_EXTRA;
			this.editorCharacter.addChild(this.allPoints).zIndex = EditorLayer.Z_INDEX_EXTRA;
			this.editorCharacter.sortChildren();
		} else {
			if (this._wireFrame) {
				this.editorCharacter.removeChild(this.wireFrame);
				this.wireFrame.destroy();
				this._wireFrame = undefined;
			}
			if (this._allPoints) {
				this.editorCharacter.removeChild(this.allPoints);
				this.allPoints.destroy();
				this._allPoints = undefined;
			}
		}
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

	private _drawAllPoints(container: Container) {
		const createDraggable = (point: PointDefinition, _index: number) => {
			const full = (point as MirrorPointDefinition);
			const draggable = new Draggable({
				createTexture: () => Texture.from(dotTexture),
				setPos: (_, x, y) => {
					point.pos = [x, y];
					full.updatePair(['pos']);
					this.observableLayer.dispatchPointUpdate();
				},
			});

			draggable.x = point.pos[0];
			draggable.y = point.pos[1];
			if (full.isMirrored()) {
				draggable.tint = 0x00ff00;
			}

			container.addChild(draggable);

			return draggable;
		};

		const dots = this.points.map(createDraggable);

		const cleanup = this.observableLayer.on('points', (points) => {
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
		});

		container.on('destroy', () => {
			cleanup();
		});
	}

	override destroy() {
		this.show(false);
		super.destroy();
	}
}
