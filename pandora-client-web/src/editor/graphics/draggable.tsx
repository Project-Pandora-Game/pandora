import { Draft, Immutable } from 'immer';
import _, { cloneDeep } from 'lodash';
import {
	Assert,
	AssetFrameworkCharacterState,
	BoneDefinition,
	CharacterSize,
	MirrorBoneLike,
	MirrorTransform,
	PointDefinition,
	type PointDefinitionCalculated,
} from 'pandora-common';
import * as PIXI from 'pixi.js';
import { FederatedPointerEvent, Texture } from 'pixi.js';
import { ReactElement, useMemo, useRef } from 'react';
import dotTexture from '../../assets/editor/dotTexture.png';
import { useEvent } from '../../common/useEvent';
import { useAppearanceConditionEvaluator } from '../../graphics/appearanceConditionEvaluator';
import { Sprite } from '../../graphics/baseComponents/sprite';
import { useTexture } from '../../graphics/useTexture';
import { GetAngle, RotateVector } from '../../graphics/utility';
import { Observable, ReadonlyObservable, useObservable } from '../../observable';
import { EditorCharacter } from './character/appearanceEditor';
import type { PointTemplateEditor } from './pointTemplateEditor';

type DraggableProps = {
	x: number;
	y: number;
	tint?: number;
	createTexture?: () => Texture;
	setPos: (x: number, y: number) => void;
	dragStart?: (event: FederatedPointerEvent) => boolean;
};
export function Draggable({
	createTexture,
	setPos,
	dragStart,
	...spriteProps
}: DraggableProps): ReactElement {
	const dragging = useRef<boolean>(false);
	const sprite = useRef<PIXI.Sprite>(null);

	const onDragStart = useEvent((event: FederatedPointerEvent) => {
		event.stopPropagation();
		if (dragging.current || !sprite.current) return;
		if (dragStart?.(event) !== false) {
			dragging.current = true;
		}
	});

	const onDragEnd = useEvent((_event: FederatedPointerEvent) => {
		dragging.current = false;
	});

	const onDragMove = useEvent((event: FederatedPointerEvent) => {
		if (!dragging.current || !sprite.current) return;
		event.stopPropagation();
		const dragPointerEnd = event.getLocalPosition(sprite.current.parent);
		setPos(
			_.clamp(Math.round(dragPointerEnd.x), 0, CharacterSize.WIDTH),
			_.clamp(Math.round(dragPointerEnd.y), 0, CharacterSize.HEIGHT),
		);
	});

	const texture = useMemo(() => (createTexture?.() ?? Texture.WHITE), [createTexture]);

	return (
		<Sprite
			{ ...spriteProps }
			ref={ sprite }
			texture={ texture }
			anchor={ [0.5, 0.5] }
			scale={ [0.5, 0.5] }
			alpha={ 0.8 }
			eventMode='static'
			onpointerdown={ onDragStart }
			onpointerup={ onDragEnd }
			onpointerupoutside={ onDragEnd }
			onglobalpointermove={ onDragMove }
		/>
	);
}

export function DraggablePointDisplay({
	templateEditor,
	draggablePoint,
}: {
	templateEditor: PointTemplateEditor;
	draggablePoint: DraggablePoint;
}): ReactElement {
	const selectedPoint = useObservable(templateEditor.targetPoint);
	const { pos, isMirror } = useDraggablePointDefinition(draggablePoint);
	const pointTexture = useTexture(dotTexture);
	const isSelected = draggablePoint === selectedPoint;

	return (
		<Draggable
			x={ pos[0] }
			y={ pos[1] }
			tint={ isSelected ?
				(isMirror ? 0xaaff00 : 0xffff00) :
				(isMirror ? 0x00ff00 : 0xffffff) }
			dragStart={ () => {
				// Only allow drag if the point is already selected
				if (templateEditor.targetPoint.value === draggablePoint)
					return true;
				// Select the point on click
				templateEditor.targetPoint.value = draggablePoint;
				return false;
			} }
			createTexture={ () => pointTexture }
			setPos={ (x, y) => draggablePoint.setPos(x, y) }
		/>
	);
}

export class DraggablePoint {
	private readonly _definition: Observable<Immutable<PointDefinitionCalculated>>;
	public readonly template: PointTemplateEditor;

	public get definition(): ReadonlyObservable<Immutable<PointDefinitionCalculated>> {
		return this._definition;
	}

	constructor(template: PointTemplateEditor, point: Immutable<PointDefinitionCalculated>) {
		this.template = template;
		this._definition = new Observable(point);
	}

	private get index(): number {
		return this._definition.value.index;
	}

	public updatePoint(point: Immutable<PointDefinitionCalculated>) {
		this._definition.value = point;
	}

	private _modifyPoint(producer: (draft: Draft<Immutable<PointDefinition>>) => void): void {
		const index = this.index;

		this.template.modifyTemplate((d) => {
			Assert(d.length > index);
			producer(d[index]);
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

	public mirrorSwap(): void {
		this._modifyPoint((p) => {
			p.pos[0] = CharacterSize.WIDTH - p.pos[0];
			p.transforms = p.transforms.map(MirrorTransform);
			p.pointType = MirrorBoneLike(p.pointType);
		});
	}

	public setTransforms(value: PointDefinition['transforms']): void {
		this._modifyPoint((p) => {
			p.transforms = cloneDeep(value);
		});
	}

	public deletePoint(): void {
		const index = this.index;
		// TODO: Make idempotent
		this.template.modifyTemplate((d) => {
			Assert(d.length > index);
			d.splice(index, 1);
		});
	}
}

export function useDraggablePointDefinition(point: DraggablePoint): Immutable<PointDefinitionCalculated> {
	return useObservable(point.definition);
}

export function DraggableBone({
	definition,
	character,
	characterState,
	type,
}: {
	definition: BoneDefinition;
	character: EditorCharacter;
	characterState: AssetFrameworkCharacterState;
	type: 'setup' | 'result';
}): ReactElement {
	const evaluator = useAppearanceConditionEvaluator(characterState);
	const pointTexture = useTexture(dotTexture);

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
			character.getAppearance().setPose(definition.name, rotation);
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
			createTexture={ () => pointTexture }
			setPos={ setPos }
		/>
	);
}
