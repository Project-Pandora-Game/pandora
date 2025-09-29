import * as z from 'zod';
import { CoordinatesSchema, SizeSchema } from '../common.ts';

export const RoomDeviceGraphicsLayerTextSchema = z.object({
	type: z.literal('text'),
	/** Module from which text is used. Must be a 'text' type module. */
	dataModule: z.string(),
	/**
	 * Offset of this layer relative to top-left
	 */
	offset: CoordinatesSchema.optional(),
	/** Size for the text */
	size: SizeSchema,
	/** Angle of the text */
	angle: z.number().optional(),
	/**
	 * Maximum font size to use. Affects size of small text and performance.
	 * @default 32
	 */
	fontSize: z.number(),
	/** Key of colorization to use for the text */
	colorizationKey: z.string().optional(),
}).strict();
export type RoomDeviceGraphicsLayerText = z.infer<typeof RoomDeviceGraphicsLayerTextSchema>;
