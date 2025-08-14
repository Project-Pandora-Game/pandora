import { z } from 'zod';
import type { ArrayCompressType } from '../../utility/misc.ts';

export const CoordinatesSchema = z.object({ x: z.number(), y: z.number() });
export type Coordinates = z.infer<typeof CoordinatesSchema>;

export const IntegerCoordinatesSchema = z.object({
	x: z.number().int(),
	y: z.number().int(),
});

export const CoordinatesCompressedSchema = z.tuple([CoordinatesSchema.shape.x, CoordinatesSchema.shape.y]);
export type CoordinatesCompressed = z.infer<typeof CoordinatesCompressedSchema>;

export const SizeSchema = z.object({
	width: z.number(),
	height: z.number(),
});
export type Size = z.infer<typeof SizeSchema>;
export type SizeCompressed = ArrayCompressType<Size, ['width', 'height']>;

export const RectangleSchema = CoordinatesSchema.merge(SizeSchema);
export type Rectangle = z.infer<typeof RectangleSchema>;
export type RectangleCompressed = [...CoordinatesCompressed, ...SizeCompressed];
