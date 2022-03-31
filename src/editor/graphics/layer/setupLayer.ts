import type { PointDefinition } from 'pandora-common/dist/character/asset/definition';
import type { GraphicsLayerProps } from '../../../graphics/graphicsLayer';
import { Graphics, Container, Sprite, Texture } from 'pixi.js';
import { Draggable } from '../draggable';
import { EditorLayer } from './editorLayer';
import dotTexture from '../../../assets/editor/dotTexture.png';

export class SetupLayer extends EditorLayer {
	private _wireFrame?: Graphics;
	private _points?: Container;

	private get wireFrame(): Graphics {
		if (!this._wireFrame) {
			const wireframe = this._wireFrame = new Graphics();
			wireframe.x = this.x;
			wireframe.y = this.y;
			this._drawWireFrame(wireframe);
			this._wireFrame.on('destroy', () => this._wireFrame = undefined);
		}
		return this._wireFrame;
	}

	private get points(): Container {
		if (!this._points) {
			this._points = new Container();
			this._drawPoints(this._points);
		}
		return this._points;
	}

	protected constructor(props: GraphicsLayerProps) {
		super(props);
	}

	public static override create = (props: GraphicsLayerProps) => new SetupLayer(props);

	protected override updateChild(): void {
		this.result = new Sprite(this.texture);
		this.result.zIndex = 1;
	}

	protected override calculateVertices(): boolean {
		// vertices are not used
		return false;
	}

	protected override calculateTriangles() {
		super.calculateTriangles();
		if (this._wireFrame) {
			this._drawWireFrame(this._wireFrame);
		}
	}

	protected show(value: boolean): void {
		if (value) {
			this.editorCharacter.addChild(this.wireFrame);
			this.editorCharacter.addChild(this.points);
		} else {
			this.editorCharacter.removeChild(this.wireFrame);
			this.editorCharacter.removeChild(this.points);
			this.wireFrame.destroy();
			this.points.destroy();
		}
	}

	private _drawWireFrame(graphics: Graphics) {
		graphics.clear();
		graphics.lineStyle(2, 0x333333, 0.3);
		const coords = this.layer.points.map((point) => point.pos);
		for (let i = 0; i < this.triangles.length; i += 3) {
			const poly = [0, 1, 2].map((p) => coords[this.triangles[i + p]]);
			graphics.drawPolygon(poly.flat());
		}
	}

	private _drawPoints(container: Container) {
		const createDraggable = (point: PointDefinition, _index: number) => {
			const draggable = new Draggable({
				createTexture: () => Texture.from(dotTexture),
				setPos: (_, x, y) => {
					point.pos = [x, y];
					this.observableLayer.dispatchPointUpdate();
				},
			});

			draggable.x = point.pos[0];
			draggable.y = point.pos[1];

			container.addChild(draggable);

			return draggable;
		};

		const dots = this.layer.points.map(createDraggable);

		const cleanup = this.observableLayer.subscribe('points', (points) => {
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
			this._points = undefined;
		});
	}
}
