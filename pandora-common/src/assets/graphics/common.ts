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

/** A cardinal direction - North/East/South/West */
export const CardinalDirectionSchema = z.enum(['N', 'E', 'S', 'W']);
/** A cardinal direction - North/East/South/West */
export type CardinalDirection = z.infer<typeof CardinalDirectionSchema>;

export const CARDINAL_DIRECTION_NAMES: Readonly<Record<CardinalDirection, string>> = {
	N: 'North',
	E: 'East',
	S: 'South',
	W: 'West',
};
