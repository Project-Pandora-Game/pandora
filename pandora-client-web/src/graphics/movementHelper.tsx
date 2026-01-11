import * as PIXI from 'pixi.js';
import { ReactElement, useCallback, useRef, type ForwardedRef } from 'react';
import { Graphics, type GraphicsProps } from './baseComponents/graphics.ts';
import type { Character } from '../character/character.ts';

export interface MovementHelperGraphicsProps extends Omit<GraphicsProps, 'draw'> {
	radius: number;
	colorUpDown?: number;
	colorLeftRight?: number;
	character?: Character;
	drawExtra?: (g: PIXI.GraphicsContext) => void;
	ref?: ForwardedRef<PIXI.Graphics>;
}

export function MovementHelperGraphics({
	radius,
	colorUpDown,
	colorLeftRight,
	character,
	drawExtra,
	...props
}: MovementHelperGraphicsProps): ReactElement | null {
	const arrowBodyLength = 0.3 * radius;
	const arrowWidthInner = Math.ceil(0.08 * radius);
	const arrowWidth = 0.32 * radius;
	const centerOffset = Math.ceil(0.1 * radius);
	const circleEdgeWidth = 4;

	const color = character?.isPlayer() ? 0x00ff00 : 0xffffff;

	const graphicsDraw = useCallback((g: PIXI.GraphicsContext) => {
		g
			.ellipse(0, 0, radius, radius)
			.fill({ color: 0x000000, alpha: 0.4 })
			.stroke({ width: circleEdgeWidth, color, alpha: 1 });

		if (colorLeftRight != null) {
			g
				.poly([
					centerOffset + 1, -arrowWidthInner,
					centerOffset + 1 + arrowBodyLength, -arrowWidthInner,
					centerOffset + 1 + arrowBodyLength, -arrowWidth,
					radius - circleEdgeWidth, 0,
					centerOffset + 1 + arrowBodyLength, arrowWidth,
					centerOffset + 1 + arrowBodyLength, arrowWidthInner,
					centerOffset + 1, arrowWidthInner,
				])
				.fill({ color: colorLeftRight, alpha: 1 })
				.poly([
					- centerOffset - 1, arrowWidthInner,
					- centerOffset - 1 - arrowBodyLength, arrowWidthInner,
					- centerOffset - 1 - arrowBodyLength, arrowWidth,
					-radius + circleEdgeWidth, 0,
					- centerOffset - 1 - arrowBodyLength, -arrowWidth,
					- centerOffset - 1 - arrowBodyLength, -arrowWidthInner,
					- centerOffset - 1, -arrowWidthInner,
				])
				.fill({ color: colorLeftRight, alpha: 1 });
		}

		if (colorUpDown != null) {
			g
				.poly([
					- arrowWidthInner, -centerOffset - 1,
					- arrowWidthInner, -centerOffset - 1 - arrowBodyLength,
					- arrowWidth, -centerOffset - 1 - arrowBodyLength,
					0, -radius + circleEdgeWidth,
					arrowWidth, - centerOffset - 1 - arrowBodyLength,
					arrowWidthInner, - centerOffset - 1 - arrowBodyLength,
					arrowWidthInner, - centerOffset - 1,
				])
				.fill({ color: colorUpDown, alpha: 1 })
				.poly([
					- arrowWidthInner, centerOffset + 1,
					- arrowWidthInner, centerOffset + 1 + arrowBodyLength,
					- arrowWidth, centerOffset + 1 + arrowBodyLength,
					0, radius - circleEdgeWidth,
					arrowWidth, centerOffset + 1 + arrowBodyLength,
					arrowWidthInner, centerOffset + 1 + arrowBodyLength,
					arrowWidthInner, centerOffset + 1,
				])
				.fill({ color: colorUpDown, alpha: 1 });
		}

		if (colorLeftRight != null || colorUpDown != null) {
			g
				.ellipse(0, 0, centerOffset, centerOffset)
				.fill({ color: 0xcccccc, alpha: 1 });
		}

		drawExtra?.(g);
	}, [radius, colorLeftRight, colorUpDown, color, drawExtra, centerOffset, arrowWidthInner, arrowBodyLength, arrowWidth]);

	return (
		<Graphics
			{ ...props }
			draw={ graphicsDraw }
		/>
	);
}

export interface PosingStateHelperGraphicsProps<TValue extends string | number> extends Omit<GraphicsProps, 'draw'> {
	ref?: ForwardedRef<PIXI.Graphics>;
	values: readonly NoInfer<TValue>[];
	value: TValue;
	/** While "value" is user-selected, some things might be forced to different value to produce overall valid result */
	actualValue?: TValue;
	onChange: (newValue: TValue) => void;
	centerValue?: number;
}

export function PosingStateHelperGraphics<const TValue extends string | number>({
	values,
	value,
	actualValue,
	onChange,
	centerValue = 0,
	...props
}: PosingStateHelperGraphicsProps<TValue>): ReactElement {
	const count = values.length;
	const radius = 17;
	const gap = 4;
	const baseAngle = 65;
	const offset = 2 * radius + gap;

	const graphicsDraw = useCallback((g: PIXI.GraphicsContext) => {

		// Draw outline
		for (let i = 0; i < count; i++) {
			const xOffset = (i - centerValue) * offset;
			if (i === 0) {
				g.beginPath()
					.arc(xOffset, 0, radius, (-270 + baseAngle) * PIXI.DEG_TO_RAD, (-90 - baseAngle) * PIXI.DEG_TO_RAD);
			}

			g.arc(xOffset, 0, radius, (-90 - baseAngle) * PIXI.DEG_TO_RAD, (-90 + baseAngle) * PIXI.DEG_TO_RAD);
		}
		for (let i = (count - 1); i >= 0; i--) {
			const xOffset = (i - centerValue) * offset;
			if (i === (count - 1)) {
				g.arc(xOffset, 0, radius, (-90 + baseAngle) * PIXI.DEG_TO_RAD, (90 - baseAngle) * PIXI.DEG_TO_RAD);
			}

			g.arc(xOffset, 0, radius, (90 - baseAngle) * PIXI.DEG_TO_RAD, (90 + baseAngle) * PIXI.DEG_TO_RAD);
		}
		g.closePath()
			.fill({ color: 0x000000, alpha: 0.5 })
			.stroke({ color: 0xcccccc, width: 2 });

		// Draw actual value
		if (actualValue != null && actualValue !== value) {
			const actualValueIndex = values.indexOf(actualValue);
			if (actualValueIndex >= 0) {
				const currentXOffset = (actualValueIndex - centerValue) * offset;
				g.circle(currentXOffset, 0, radius - 5)
					.stroke({ color: 0xcccccc, alpha: 0.5, width: 4 });
			}
		}

		// Draw selected value
		const currentValueIndex = values.indexOf(value);
		if (currentValueIndex >= 0) {
			const currentXOffset = (currentValueIndex - centerValue) * offset;
			g.circle(currentXOffset, 0, radius - 3)
				.fill({ color: 0xcccccc });
		}
	}, [centerValue, count, values, offset, value, actualValue]);

	const onMove = useCallback((x: number, y: number): void => {
		const targetOffset = Math.round(x / (2 * radius + gap)) + centerValue;
		if (targetOffset >= 0 && targetOffset < count && y >= -radius && y <= radius) {
			onChange(values[targetOffset]);
		}
	}, [centerValue, count, onChange, values]);

	const dragging = useRef<PIXI.Point | null>(null);

	const onPointerDown = useCallback((event: PIXI.FederatedPointerEvent) => {
		if (event.button !== 1) {
			event.stopPropagation();
			dragging.current = event.getLocalPosition<PIXI.Point>(event.target);
			onMove(dragging.current.x, dragging.current.y);
		}
	}, [onMove]);

	const onPointerUp = useCallback((_event: PIXI.FederatedPointerEvent) => {
		dragging.current = null;
	}, []);

	const onPointerMove = useCallback((event: PIXI.FederatedPointerEvent) => {
		if (dragging.current) {
			const dragPointerEnd = event.getLocalPosition(event.target);
			onMove(
				dragPointerEnd.x,
				dragPointerEnd.y,
			);
		}
	}, [onMove]);

	const hitArea = new PIXI.Rectangle(-radius - centerValue * offset, -radius, (count) * offset - gap, 2 * radius);

	return (
		<Graphics
			{ ...props }
			draw={ graphicsDraw }
			eventMode='static'
			cursor='pointer'
			hitArea={ hitArea }
			onpointerdown={ onPointerDown }
			onpointermove={ onPointerMove }
			onpointerup={ onPointerUp }
			onpointerupoutside={ onPointerUp }
		/>
	);
}
