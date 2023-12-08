import { Graphics, _ReactPixi } from '@pixi/react';
import * as PIXI from 'pixi.js';
import React, { ReactElement, useCallback } from 'react';

export interface MovementHelperGraphicsProps extends Omit<_ReactPixi.IGraphics, 'draw'> {
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
			.lineStyle(4, 0xffffff, 1)
			.drawEllipse(0, 0, radius, radius)
			.lineStyle(0);

		if (colorLeftRight != null) {
			g.beginFill(colorLeftRight, 1)
				.drawPolygon([
					centerOffset, -arrowWidthInner,
					centerOffset + arrowBodyLength, -arrowWidthInner,
					centerOffset + arrowBodyLength, -arrowWidth,
					radius, 0,
					centerOffset + arrowBodyLength, arrowWidth,
					centerOffset + arrowBodyLength, arrowWidthInner,
					centerOffset, arrowWidthInner,
				])
				.endFill()
				.beginFill(colorLeftRight, 1)
				.drawPolygon([
					- centerOffset, arrowWidthInner,
					- centerOffset - arrowBodyLength, arrowWidthInner,
					- centerOffset - arrowBodyLength, arrowWidth,
					-radius, 0,
					- centerOffset - arrowBodyLength, -arrowWidth,
					- centerOffset - arrowBodyLength, -arrowWidthInner,
					- centerOffset, -arrowWidthInner,
				])
				.endFill();
		}

		if (colorUpDown != null) {
			g.beginFill(colorUpDown, 1)
				.drawPolygon([
					- arrowWidthInner, -centerOffset,
					- arrowWidthInner, -centerOffset - arrowBodyLength,
					- arrowWidth, -centerOffset - arrowBodyLength,
					0, -radius,
					arrowWidth, - centerOffset - arrowBodyLength,
					arrowWidthInner, - centerOffset - arrowBodyLength,
					arrowWidthInner, - centerOffset,
				])
				.endFill()
				.beginFill(colorUpDown, 1)
				.drawPolygon([
					- arrowWidthInner, centerOffset,
					- arrowWidthInner, centerOffset + arrowBodyLength,
					- arrowWidth, centerOffset + arrowBodyLength,
					0, radius,
					arrowWidth, centerOffset + arrowBodyLength,
					arrowWidthInner, centerOffset + arrowBodyLength,
					arrowWidthInner, centerOffset,
				])
				.endFill();
		}
		g.beginFill(0xffffff, 1)
			.drawEllipse(0, 0, centerOffset, centerOffset)
			.endFill();
	}, [radius, colorLeftRight, colorUpDown]);

	return (
		<Graphics
			{ ...props }
			draw={ graphicsDraw }
		/>
	);
}
