import { Texture, Sprite, InteractionEvent, DisplayObject } from 'pixi.js';
import { BoneDefinition, CharacterSize, PointDefinition } from 'pandora-common';
import { GetAngle, RotateVector } from '../../graphics/utility';
import { AssetGraphicsLayer, PointDefinitionCalculated } from '../../assets/assetGraphics';
import dotTexture from '../../assets/editor/dotTexture.png';
import { Editor } from '../editor';
import { TypedEventEmitter } from '../../event';
import type { GraphicsCharacterEditor } from './character/editorCharacter';
import { GraphicsManagerInstance } from '../../assets/graphicsManager';
import _ from 'lodash';

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
			_.clamp(Math.round(dragPointerEnd.x), 0, CharacterSize.WIDTH),
			_.clamp(Math.round(dragPointerEnd.y), 0, CharacterSize.HEIGHT),
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
				// Cannot drag template point
				if (typeof this._getDefinitionLocation()[0] === 'string')
					return false;
				// Only allow drag if the point is already selected
				if (editor.targetPoint.value === this)
					return true;
				// Select the point on click
				editor.targetPoint.value = this;
				return false;
			},
			createTexture: () => Texture.from(dotTexture),
			setPos: (_spirte, x, y) => this.setPos(x, y),
		});
		this.layer = layer;
		this.updatePoint(point, false);
	}

	public updatePoint(point: PointDefinitionCalculated, isSelected: boolean) {
		this.point = point;
		this.draggable.x = point.pos[0];
		this.draggable.y = point.pos[1];
		if (isSelected) {
			this.draggable.tint = point.isMirror ? 0xaaff00 : 0xffff00;
		} else {
			this.draggable.tint = point.isMirror ? 0x00ff00 : 0xffffff;
		}
		this.emit('change', undefined);
	}

	private _getDefinitionLocation(): [AssetGraphicsLayer | string, PointDefinition] {
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
		if (typeof layer.definition.points === 'string') {
			const template = GraphicsManagerInstance.value?.getTemplate(layer.definition.points);
			if (!template) {
				throw new Error(`Unknown template '${layer.definition.points}'`);
			}
			if (template.length <= this.point.index) {
				throw new Error('Invalid attempt to set point position');
			}
			return [layer.definition.points, template[this.point.index]];
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
		if (typeof layer === 'string') {
			throw new Error('Cannot modify template');
		}
		point.pos = [x, y];
		layer.onChange(false);
	}

	public get pointType(): PointDefinition['pointType'] {
		return this._getDefinitionLocation()[1].pointType;
	}

	public setPointType(type: PointDefinition['pointType']): void {
		const [layer, point] = this._getDefinitionLocation();
		if (typeof layer === 'string') {
			throw new Error('Cannot modify template');
		}
		point.pointType = type;
		layer.onChange(false);
	}

	public get mirror(): boolean {
		return this.point.mirror;
	}

	public setMirror(value: boolean): void {
		const [layer, point] = this._getDefinitionLocation();
		if (typeof layer === 'string') {
			throw new Error('Cannot modify template');
		}
		point.mirror = value;
		layer.onChange(false);
	}

	public get transforms(): PointDefinition['transforms'] {
		return this._getDefinitionLocation()[1].transforms;
	}

	public setTransforms(value: PointDefinition['transforms']): void {
		const [layer, point] = this._getDefinitionLocation();
		if (typeof layer === 'string') {
			throw new Error('Cannot modify template');
		}
		point.transforms = value;
		layer.onChange(false);
	}

	public deletePoint(): void {
		const layer = this._getDefinitionLocation()[0];
		if (typeof layer === 'string') {
			throw new Error('Cannot modify template');
		}
		if (!Array.isArray(layer.definition.points)) {
			throw new Error('Assertion failed');
		}
		// TODO: Make idempotent
		layer.definition.points.splice(this.point.index, 1);
		layer.onChange(false);
	}
}

export class DraggableBone {
	readonly draggable: Draggable;

	readonly character: GraphicsCharacterEditor;
	readonly definition: BoneDefinition;
	readonly isResult: boolean;

	constructor(character: GraphicsCharacterEditor, definition: BoneDefinition, isResult: boolean) {
		this.draggable = new Draggable({
			createTexture: () => Texture.from(dotTexture),
			setPos: (_sprite, x, y) => this.setPos(x, y),
		});
		this.draggable.tint = 0xff00ff;
		this.draggable.alpha = 0.8;

		this.character = character;
		this.definition = definition;
		this.isResult = isResult;

		this.update();
	}

	private _rotation: number = 0;

	private setPos(x: number, y: number): void {
		if (this.isResult) {
			let bx = this.definition.x;
			let by = this.definition.y;
			if (this.definition.parent) {
				[bx, by] = this.character.evalTransform([bx, by], [{ type: 'rotate', bone: this.definition.parent.name, value: this.definition.isMirror ? -1 : 1 }], this.definition.isMirror, null);
			}
			let angle = GetAngle(x - bx, y - by);
			if (this.definition.isMirror) {
				angle = ((180 + 360) - angle) % 360;
			}
			if (this.definition.parent) {
				angle -= this.character.getBoneLikeValue(this.definition.parent.name);
			}
			let rotation = angle - (this.definition.baseRotation ?? 0);
			rotation = (Math.round(rotation)) % 360;
			if (rotation > 180) {
				rotation -= 360;
			}
			this.character.appearanceContainer.appearance.setPose(this.definition.name, rotation);
		}
	}

	setRotation(rotation: number): void {
		this._rotation = (Math.round(rotation)) % 360;
		if (this._rotation > 180) {
			this._rotation -= 360;
		}
		this.update();
	}

	private update(): void {
		if (this.isResult) {
			let angle = this._rotation + (this.definition.baseRotation ?? 0);
			let x = this.definition.x;
			let y = this.definition.y;
			if (this.definition.parent) {
				angle += this.character.getBoneLikeValue(this.definition.parent.name);
				[x, y] = this.character.evalTransform([x, y], [{ type: 'rotate', bone: this.definition.parent.name, value: this.definition.isMirror ? -1 : 1 }], this.definition.isMirror, null);
			}
			if (this.definition.isMirror) {
				angle = 180 - angle;
			}
			const [shiftX, shiftY] = RotateVector(20, 0, angle);
			this.draggable.position.set(x + shiftX, y + shiftY);
		} else {
			this.draggable.position.set(this.definition.x, this.definition.y);
		}
	}
}

