import { Texture, InteractionEvent, DisplayObject } from 'pixi.js';
import { BoneDefinition, CharacterSize, PointDefinition } from 'pandora-common';
import { GetAngle, RotateVector } from '../../graphics/utility';
import { AssetGraphicsLayer, PointDefinitionCalculated } from '../../assets/assetGraphics';
import dotTexture from '../../assets/editor/dotTexture.png';
import { GraphicsManagerInstance } from '../../assets/graphicsManager';
import _ from 'lodash';
import React, { ReactElement, useMemo, useRef } from 'react';
import { useEvent } from '../../common/useEvent';
import { Sprite } from '@saitonakamura/react-pixi';
import { useEditor } from '../editorContextProvider';
import { Observable, useObservable } from '../../observable';
import { useAppearanceConditionEvaluator } from '../../graphics/appearanceConditionEvaluator';
import { AppearanceContainer } from '../../character/character';

type DraggableProps = {
	x: number;
	y: number;
	tint?: number;
	createTexture?: () => Texture;
	setPos: (x: number, y: number) => void;
	dragStart?: (event: InteractionEvent) => boolean;
};
export function Draggable({
	createTexture,
	setPos,
	dragStart,
	...spriteProps
}: DraggableProps): ReactElement {
	const dragging = useRef<DisplayObject | null>(null);

	const onDragStart = useEvent((event: InteractionEvent) => {
		event.stopPropagation();
		if (dragging.current) return;
		if (dragStart?.(event) !== false) {
			dragging.current = event.currentTarget;
		}
	});

	const onDragEnd = useEvent((_event: InteractionEvent) => {
		dragging.current = null;
	});

	const onDragMove = useEvent((event: InteractionEvent) => {
		const obj = event.currentTarget;
		if (dragging.current !== obj) return;
		event.stopPropagation();
		const dragPointerEnd = event.data.getLocalPosition(obj.parent);

		setPos(
			_.clamp(Math.round(dragPointerEnd.x), 0, CharacterSize.WIDTH),
			_.clamp(Math.round(dragPointerEnd.y), 0, CharacterSize.HEIGHT),
		);
	});

	const texture = useMemo(() => (createTexture?.() ?? Texture.WHITE), [createTexture]);

	return (
		<Sprite
			{ ...spriteProps }
			texture={ texture }
			anchor={ [0.5, 0.5] }
			scale={ [0.5, 0.5] }
			alpha={ 0.8 }
			interactive
			pointerdown={ onDragStart }
			pointerup={ onDragEnd }
			pointerupoutside={ onDragEnd }
			pointermove={ onDragMove }
		/>
	);
}

export function DraggablePointDisplay({
	draggablePoint,
}: {
	draggablePoint: DraggablePoint;
}): ReactElement {
	const editor = useEditor();
	const selectedPoint = useObservable(editor.targetPoint);
	const point = useObservable(draggablePoint.point);
	const isSelected = draggablePoint === selectedPoint;

	return (
		<Draggable
			x={ point.pos[0] }
			y={ point.pos[1] }
			tint={ isSelected ?
				(point.isMirror ? 0xaaff00 : 0xffff00) :
				(point.isMirror ? 0x00ff00 : 0xffffff) }
			dragStart={ () => {
				// Cannot drag template point
				if (typeof draggablePoint.getDefinitionLocation()[0] === 'string')
					return false;
				// Only allow drag if the point is already selected
				if (editor.targetPoint.value === draggablePoint)
					return true;
				// Select the point on click
				editor.targetPoint.value = draggablePoint;
				return false;
			} }
			createTexture={ () => Texture.from(dotTexture) }
			setPos={ (x, y) => draggablePoint.setPos(x, y) }
		/>
	);
}

export class DraggablePoint {
	readonly point: Observable<PointDefinitionCalculated>;
	readonly layer: AssetGraphicsLayer;

	constructor(layer: AssetGraphicsLayer, point: PointDefinitionCalculated) {
		this.layer = layer;
		this.point = new Observable(point);
	}

	public updatePoint(point: PointDefinitionCalculated) {
		this.point.value = point;
	}

	public getDefinitionLocation(): [AssetGraphicsLayer | string, PointDefinition] {
		let layer = this.layer;
		const point = this.point.value;
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
			if (template.length <= point.index) {
				throw new Error('Invalid attempt to set point position');
			}
			return [layer.definition.points, template[point.index]];
		}
		if (layer.definition.points.length <= point.index) {
			throw new Error('Invalid attempt to set point position');
		}
		return [layer, layer.definition.points[point.index]];
	}

	public get x(): number {
		return this.point.value.pos[0];
	}

	public get y(): number {
		return this.point.value.pos[1];
	}

	public setPos(x: number, y: number): void {
		if (this.point.value.isMirror) {
			x = CharacterSize.WIDTH - x;
		}
		const [layer, point] = this.getDefinitionLocation();
		if (typeof layer === 'string') {
			throw new Error('Cannot modify template');
		}
		point.pos = [x, y];
		layer.onChange(false);
	}

	public get pointType(): PointDefinition['pointType'] {
		return this.getDefinitionLocation()[1].pointType;
	}

	public setPointType(type: PointDefinition['pointType']): void {
		const [layer, point] = this.getDefinitionLocation();
		if (typeof layer === 'string') {
			throw new Error('Cannot modify template');
		}
		point.pointType = type;
		layer.onChange(false);
	}

	public get mirror(): boolean {
		return this.point.value.mirror;
	}

	public setMirror(value: boolean): void {
		const [layer, point] = this.getDefinitionLocation();
		if (typeof layer === 'string') {
			throw new Error('Cannot modify template');
		}
		point.mirror = value;
		layer.onChange(false);
	}

	public get transforms(): PointDefinition['transforms'] {
		return this.getDefinitionLocation()[1].transforms;
	}

	public setTransforms(value: PointDefinition['transforms']): void {
		const [layer, point] = this.getDefinitionLocation();
		if (typeof layer === 'string') {
			throw new Error('Cannot modify template');
		}
		point.transforms = value;
		layer.onChange(false);
	}

	public deletePoint(): void {
		const layer = this.getDefinitionLocation()[0];
		if (typeof layer === 'string') {
			throw new Error('Cannot modify template');
		}
		if (!Array.isArray(layer.definition.points)) {
			throw new Error('Assertion failed');
		}
		// TODO: Make idempotent
		layer.definition.points.splice(this.point.value.index, 1);
		layer.onChange(false);
	}
}

export function DraggableBone({
	definition,
	character,
	type,
}: {
	definition: BoneDefinition;
	character: AppearanceContainer;
	type: 'setup' | 'result';
}): ReactElement {
	const evaluator = useAppearanceConditionEvaluator(character);

	const setPos = useEvent((x: number, y: number): void => {
		if (type === 'result') {
			let bx = definition.x;
			let by = definition.y;
			if (definition.parent) {
				[bx, by] = evaluator.evalTransform([bx, by], [{ type: 'rotate', bone: definition.parent.name, value: definition.isMirror ? -1 : 1 }], definition.isMirror, null);
			}
			let angle = GetAngle(x - bx, y - by);
			if (definition.isMirror) {
				angle = ((180 + 360) - angle) % 360;
			}
			if (definition.parent) {
				angle -= evaluator.getBoneLikeValue(definition.parent.name);
			}
			let rotation = angle - (definition.baseRotation ?? 0);
			rotation = (Math.round(rotation)) % 360;
			if (rotation > 180) {
				rotation -= 360;
			}
			character.appearance.setPose(definition.name, rotation);
		}
	});

	const [posX, posY] = useMemo(() => {
		if (type === 'result') {
			let angle = evaluator.getBoneLikeValue(definition.name) + (definition.baseRotation ?? 0);
			let x = definition.x;
			let y = definition.y;
			if (definition.parent) {
				angle += evaluator.getBoneLikeValue(definition.parent.name);
				[x, y] = evaluator.evalTransform([x, y], [{ type: 'rotate', bone: definition.parent.name, value: definition.isMirror ? -1 : 1 }], definition.isMirror, null);
			}
			if (definition.isMirror) {
				angle = 180 - angle;
			}
			const [shiftX, shiftY] = RotateVector(20, 0, angle);
			return [x + shiftX, y + shiftY];
		} else {
			return [definition.x, definition.y];
		}
	}, [definition, evaluator, type]);

	return (
		<Draggable
			x={ posX }
			y={ posY }
			tint={ 0xff00ff }
			createTexture={ () => Texture.from(dotTexture) }
			setPos={ setPos }
		/>
	);
}
