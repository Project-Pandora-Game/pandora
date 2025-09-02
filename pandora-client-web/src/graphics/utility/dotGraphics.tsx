import type * as PIXI from 'pixi.js';
import { useCallback, type ReactElement, type RefAttributes } from 'react';
import { Graphics, type GraphicsProps } from '../baseComponents/graphics.ts';

export function DotGraphics({ size, ref, ...props }: {
	size: number;
} & Omit<GraphicsProps, 'draw'> & RefAttributes<PIXI.Graphics>): ReactElement {
	const draw = useCallback((g: PIXI.GraphicsContext) => {
		const hSize = size / 2;

		g.rect(-hSize, -hSize, size, size)
			.fill({ color: 0xffffff })
			.stroke({ color: 0x000000, pixelLine: true });
	}, [size]);

	return (
		<Graphics
			{ ...props }
			draw={ draw }
			ref={ ref }
		/>
	);
}
