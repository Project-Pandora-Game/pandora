import { z } from 'zod';

export const CoordinatesSchema = z.object({ x: z.number(), y: z.number() });
export type Coordinates = z.infer<typeof CoordinatesSchema>;

export const CoordinatesCompressedSchema = z.tuple([CoordinatesSchema.shape.x, CoordinatesSchema.shape.y]);
export type CoordinatesCompressed = z.infer<typeof CoordinatesCompressedSchema>;

export const SizeSchema = z.object({
	width: z.number(),
	height: z.number(),
});
export type Size = z.infer<typeof SizeSchema>;

export const RectangleSchema = CoordinatesSchema.merge(SizeSchema);
export type Rectangle = z.infer<typeof RectangleSchema>;
