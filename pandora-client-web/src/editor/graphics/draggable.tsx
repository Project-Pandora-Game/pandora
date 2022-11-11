import { Texture, InteractionEvent, DisplayObject } from 'pixi.js';
import { Assert, BoneDefinition, CharacterSize, LayerDefinition, PointDefinition } from 'pandora-common';
import { GetAngle, RotateVector } from '../../graphics/utility';
import { AssetGraphicsLayer, PointDefinitionCalculated } from '../../assets/assetGraphics';
import dotTexture from '../../assets/editor/dotTexture.png';
import { GraphicsManagerInstance } from '../../assets/graphicsManager';
import _, { cloneDeep } from 'lodash';
import React, { ReactElement, useMemo, useRef } from 'react';
import { useEvent } from '../../common/useEvent';
import { Sprite } from '@saitonakamura/react-pixi';
import { useEditor } from '../editorContextProvider';
import { Observable, ReadonlyObservable, useObservable } from '../../observable';
import { useAppearanceConditionEvaluator } from '../../graphics/appearanceConditionEvaluator';
import { AppearanceContainer } from '../../character/character';
import { Draft, Immutable } from 'immer';

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
	const { pos, isMirror } = useDraggablePointDefinition(draggablePoint);
	const isSelected = draggablePoint === selectedPoint;

	return (
		<Draggable
			x={ pos[0] }
			y={ pos[1] }
			tint={ isSelected ?
				(isMirror ? 0xaaff00 : 0xffff00) :
				(isMirror ? 0x00ff00 : 0xffffff) }
			dragStart={ () => {
				// Cannot drag template point
				if (typeof draggablePoint.getDefinitionLocation() === 'string')
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
	private readonly _definition: Observable<PointDefinitionCalculated>;
	readonly layer: AssetGraphicsLayer;

	public get definition(): ReadonlyObservable<Immutable<PointDefinitionCalculated>> {
		return this._definition;
	}

	constructor(layer: AssetGraphicsLayer, point: PointDefinitionCalculated) {
		this.layer = layer;
		this._definition = new Observable(point);
	}

	private get index(): number {
		return this._definition.value.index;
	}

	public updatePoint(point: PointDefinitionCalculated) {
		this._definition.value = point;
	}

	public getDefinitionLocation(): AssetGraphicsLayer | string {
		let layer = this.layer;
		const index = this.index;
		if (layer.mirror && layer.isMirror) {
			layer = layer.mirror;
		}
		let d: Immutable<LayerDefinition> = layer.definition.value;
		if (typeof d.points === 'number') {
			layer = layer.asset.layers[d.points];
			d = layer.definition.value;
			if (typeof d.points === 'number' || typeof d.points === 'string') {
				throw new Error('More than one jump in points reference');
			}
		}
		if (typeof d.points === 'string') {
			const template = GraphicsManagerInstance.value?.getTemplate(d.points);
			if (!template) {
				throw new Error(`Unknown template '${d.points}'`);
			}
			if (template.length <= index) {
				throw new Error('Invalid attempt to set point position');
			}
			return d.points;
		}
		if (d.points.length <= index) {
			throw new Error('Invalid attempt to set point position');
		}
		return layer;
	}

	private _modifyPoint(producer: (draft: Draft<Immutable<PointDefinition>>) => void): void {
		let layer = this.layer;
		const index = this.index;
		if (layer.mirror && layer.isMirror) {
			layer = layer.mirror;
		}
		let def: Immutable<LayerDefinition> = layer.definition.value;
		if (typeof def.points === 'number') {
			layer = layer.asset.layers[def.points];
			def = layer.definition.value;
			if (typeof def.points === 'number' || typeof def.points === 'string') {
				throw new Error('More than one jump in points reference');
			}
		}
		layer._modifyDefinition((d) => {
			Assert(typeof d.points !== 'number' && typeof d.points !== 'string' && d.points.length > index);
			producer(d.points[index]);
		});
	}

	public setPos(x: number, y: number): void {
		if (this._definition.value.isMirror) {
			x = CharacterSize.WIDTH - x;
		}
		this._modifyPoint((p) => {
			p.pos = [x, y];
		});
	}

	public setPointType(type: PointDefinition['pointType']): void {
		this._modifyPoint((p) => {
			p.pointType = type;
		});
	}

	public setMirror(value: boolean): void {
		this._modifyPoint((p) => {
			p.mirror = value;
		});
	}

	public setTransforms(value: PointDefinition['transforms']): void {
		this._modifyPoint((p) => {
			p.transforms = cloneDeep(value);
		});
	}

	public deletePoint(): void {
		const layer = this.getDefinitionLocation();
		if (typeof layer === 'string') {
			throw new Error('Cannot modify template');
		}
		const index = this.index;
		// TODO: Make idempotent
		layer._modifyDefinition((d) => {
			Assert(typeof d.points !== 'number' && typeof d.points !== 'string' && d.points.length > index);
			d.points.splice(index, 1);
		});
	}
}

export function useDraggablePointDefinition(point: DraggablePoint): Immutable<PointDefinitionCalculated> {
	return useObservable(point.definition);
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
