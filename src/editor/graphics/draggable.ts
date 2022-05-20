import { Texture, Sprite, InteractionEvent, DisplayObject } from 'pixi.js';
import { CharacterSize } from 'pandora-common';
import { Clamp } from '../../graphics/utility';

type DraggableProps = {
	createTexture?: () => Texture;
	setPos: (sprite: Sprite, x: number, y: number) => void;
	dragStart?: (event: InteractionEvent) => void;
};
export class Draggable extends Sprite {
	private readonly _setPos: (sprite: Sprite, x: number, y: number) => void;
	private readonly _dragStart: (event: InteractionEvent) => void;

	private _dragging?: DisplayObject;

	constructor(props: DraggableProps) {
		super(props.createTexture?.() ?? Texture.WHITE);
		this.anchor.set(0.5);
		this.scale.set(0.5);
		this.alpha = 0.8;
		this.interactive = true;

		this._setPos = props.setPos;
		this._dragStart = props.dragStart ?? (() => { /** */ });

		this
			.on('pointerdown', this._onDragStart.bind(this))
			.on('pointerup', this._onDragEnd.bind(this))
			.on('pointerupoutside', this._onDragEnd.bind(this))
			.on('pointermove', this._onDragMove.bind(this));
	}

	private _onDragStart(event: InteractionEvent) {
		event.stopPropagation();
		if (this._dragging) return;
		this._dragging = event.currentTarget;
		this._dragStart(event);
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
