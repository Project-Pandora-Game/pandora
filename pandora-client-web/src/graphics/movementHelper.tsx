import * as PIXI from 'pixi.js';
import { ReactElement, useCallback } from 'react';
import { Graphics, type GraphicsProps } from './baseComponents/graphics';

export interface MovementHelperGraphicsProps extends Omit<GraphicsProps, 'draw'> {
	radius: number;
	colorUpDown?: number;
	colorLeftRight?: number;
}

export function MovementHelperGraphics({
	radius,
	colorUpDown,
	colorLeftRight,
	...props
}: MovementHelperGraphicsProps): ReactElement | null {
	const arrowBodyLength = 0.3 * radius;
	const arrowWidthInner = Math.ceil(0.08 * radius);
	const arrowWidth = 0.32 * radius;
	const centerOffset = Math.ceil(0.1 * radius);
	const circleEdgeWidth = 4;

	const graphicsDraw = useCallback((g: PIXI.GraphicsContext) => {
		g
			.ellipse(0, 0, radius, radius)
			.fill({ color: 0x000000, alpha: 0.4 })
			.stroke({ width: circleEdgeWidth, color: 0xffffff, alpha: 1 });

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
		g
			.ellipse(0, 0, centerOffset, centerOffset)
			.fill({ color: 0xffffff, alpha: 1 });
	}, [radius, colorLeftRight, colorUpDown, centerOffset, arrowWidthInner, arrowBodyLength, arrowWidth]);

	return (
		<Graphics
			{ ...props }
			draw={ graphicsDraw }
		/>
	);
}
