import { Texture, Sprite, InteractionEvent, DisplayObject } from 'pixi.js';
import { CharacterSize, PointDefinition } from 'pandora-common';
import { Clamp } from '../../graphics/utility';
import { AssetGraphicsLayer, PointDefinitionCalculated } from '../../assets/assetGraphics';
import dotTexture from '../../assets/editor/dotTexture.png';
import { Editor } from '../editor';
import { TypedEventEmitter } from '../../event';

type DraggableProps = {
	createTexture?: () => Texture;
	setPos: (sprite: Draggable, x: number, y: number) => void;
	dragStart?: (event: InteractionEvent) => boolean;
};
export class Draggable extends Sprite {
	private readonly _setPos: DraggableProps['setPos'];
	private readonly _dragStart: DraggableProps['dragStart'];

	private _dragging?: DisplayObject;

	constructor(props: DraggableProps) {
		super(props.createTexture?.() ?? Texture.WHITE);
		this.anchor.set(0.5);
		this.scale.set(0.5);
		this.alpha = 0.8;
		this.interactive = true;

		this._setPos = props.setPos;
		this._dragStart = props.dragStart;

		this
			.on('pointerdown', this._onDragStart.bind(this))
			.on('pointerup', this._onDragEnd.bind(this))
			.on('pointerupoutside', this._onDragEnd.bind(this))
			.on('pointermove', this._onDragMove.bind(this));
	}

	private _onDragStart(event: InteractionEvent) {
		event.stopPropagation();
		if (this._dragging) return;
		if (this._dragStart?.(event) !== false) {
			this._dragging = event.currentTarget;
		}
	}

	private _onDragEnd(_event: InteractionEvent) {
		this._dragging = undefined;
	}

	private _onDragMove(event: InteractionEvent) {
		const obj = event.currentTarget;
		if (this._dragging !== obj) return;
		event.stopPropagation();
		const dragPointerEnd = event.data.getLocalPosition(obj.parent);

		this._setPos(
			this,
			Clamp(Math.round(dragPointerEnd.x), 0, CharacterSize.WIDTH),
			Clamp(Math.round(dragPointerEnd.y), 0, CharacterSize.HEIGHT),
		);
	}
}

export class DraggablePoint extends TypedEventEmitter<{
	change: undefined;
}> {
	private point!: PointDefinitionCalculated;
	readonly layer: AssetGraphicsLayer;
	readonly draggable: Draggable;

	constructor(editor: Editor, layer: AssetGraphicsLayer, point: PointDefinitionCalculated) {
		super();
		this.draggable = new Draggable({
			dragStart: () => {
				if (editor.targetPoint.value === this)
					return true;
				editor.targetPoint.value = this;
				return false;
			},
			createTexture: () => Texture.from(dotTexture),
			setPos: (_, x, y) => this.setPos(x, y),
		});
		this.layer = layer;
		this.updatePoint(point);
	}

	public updatePoint(point: PointDefinitionCalculated) {
		this.point = point;
		this.draggable.x = point.pos[0];
		this.draggable.y = point.pos[1];
		this.draggable.tint = point.isMirror ? 0x00ff00 : 0xffffff;
		this.emit('change', undefined);
	}

	private _getDefinitionLocation(): [AssetGraphicsLayer, PointDefinition] {
		let layer = this.layer;
		if (layer.mirror && layer.isMirror) {
			layer = layer.mirror;
		}
		if (typeof layer.definition.points === 'number') {
			layer = layer.asset.layers[layer.definition.points];
			if (!Array.isArray(layer.definition.points)) {
				throw new Error('More than one jump in points reference');
			}
		}
		if (layer.definition.points.length <= this.point.index) {
			throw new Error('Invalid attempt to set point position');
		}
		return [layer, layer.definition.points[this.point.index]];
	}

	public get x(): number {
		return this.point.pos[0];
	}

	public get y(): number {
		return this.point.pos[1];
	}

	public setPos(x: number, y: number): void {
		if (this.point.isMirror) {
			x = CharacterSize.WIDTH - x;
		}
		const [layer, point] = this._getDefinitionLocation();
		point.pos = [x, y];
		layer.onChange();
	}

	public get pointType(): PointDefinition['pointType'] {
		return this._getDefinitionLocation()[1].pointType;
	}

	public setPointType(type: PointDefinition['pointType']): void {
		const [layer, point] = this._getDefinitionLocation();
		point.pointType = type;
		layer.onChange();
	}

	public get mirror(): boolean {
		return this.point.mirror;
	}

	public setMirror(value: boolean): void {
		const [layer, point] = this._getDefinitionLocation();
		point.mirror = value;
		layer.onChange();
	}

	public get transforms(): PointDefinition['transforms'] {
		return this._getDefinitionLocation()[1].transforms;
	}

	public setTransforms(value:  PointDefinition['transforms']): void {
		const [layer, point] = this._getDefinitionLocation();
		point.transforms = value;
		layer.onChange();
	}

	public deletePoint(): void {
		const layer = this._getDefinitionLocation()[0];
		if (!Array.isArray(layer.definition.points)) {
			throw new Error('Assertion failed');
		}
		// TODO: Make idempotent
		layer.definition.points.splice(this.point.index, 1);
		layer.onChange();
	}
}
