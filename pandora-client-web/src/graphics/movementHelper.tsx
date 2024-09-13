import * as PIXI from 'pixi.js';
import React, { ReactElement, useCallback } from 'react';
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
	const arrowBodyLength = 15;
	const arrowWidthInner = 4;
	const arrowWidth = 16;
	const centerOffset = 5;

	const graphicsDraw = useCallback((g: PIXI.Graphics) => {
		g.clear()
			.ellipse(0, 0, radius, radius)
			.stroke({ width: 4, color: 0xffffff, alpha: 1 });

		if (colorLeftRight != null) {
			g
				.poly([
					centerOffset, -arrowWidthInner,
					centerOffset + arrowBodyLength, -arrowWidthInner,
					centerOffset + arrowBodyLength, -arrowWidth,
					radius, 0,
					centerOffset + arrowBodyLength, arrowWidth,
					centerOffset + arrowBodyLength, arrowWidthInner,
					centerOffset, arrowWidthInner,
				])
				.fill({ color: colorLeftRight, alpha: 1 })
				.poly([
					- centerOffset, arrowWidthInner,
					- centerOffset - arrowBodyLength, arrowWidthInner,
					- centerOffset - arrowBodyLength, arrowWidth,
					-radius, 0,
					- centerOffset - arrowBodyLength, -arrowWidth,
					- centerOffset - arrowBodyLength, -arrowWidthInner,
					- centerOffset, -arrowWidthInner,
				])
				.fill({ color: colorLeftRight, alpha: 1 });
		}

		if (colorUpDown != null) {
			g
				.poly([
					- arrowWidthInner, -centerOffset,
					- arrowWidthInner, -centerOffset - arrowBodyLength,
					- arrowWidth, -centerOffset - arrowBodyLength,
					0, -radius,
					arrowWidth, - centerOffset - arrowBodyLength,
					arrowWidthInner, - centerOffset - arrowBodyLength,
					arrowWidthInner, - centerOffset,
				])
				.fill({ color: colorUpDown, alpha: 1 })
				.poly([
					- arrowWidthInner, centerOffset,
					- arrowWidthInner, centerOffset + arrowBodyLength,
					- arrowWidth, centerOffset + arrowBodyLength,
					0, radius,
					arrowWidth, centerOffset + arrowBodyLength,
					arrowWidthInner, centerOffset + arrowBodyLength,
					arrowWidthInner, centerOffset,
				])
				.fill({ color: colorUpDown, alpha: 1 });
		}
		g
			.ellipse(0, 0, centerOffset, centerOffset)
			.fill({ color: 0xffffff, alpha: 1 });
	}, [radius, colorLeftRight, colorUpDown]);

	return (
		<Graphics
			{ ...props }
			draw={ graphicsDraw }
		/>
	);
}
