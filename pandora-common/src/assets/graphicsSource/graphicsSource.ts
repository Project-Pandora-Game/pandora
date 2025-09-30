import * as z from 'zod';
import { AssetIdSchema } from '../base.ts';
import { PointTemplateSourceSchema } from '../graphics/points.ts';
import { GraphicsSourceLayerSchema, GraphicsSourceRoomDeviceLayerSchema } from './layer.ts';

export const AssetSourceGraphicsDefinitionSchema = z.object({
	layers: GraphicsSourceLayerSchema.array(),
}).strict();
export type AssetSourceGraphicsDefinition = z.infer<typeof AssetSourceGraphicsDefinitionSchema>;

export const AssetSourceGraphicsRoomDeviceDefinitionSchema = z.object({
	/** The graphical display of the device */
	layers: GraphicsSourceRoomDeviceLayerSchema.array(),
}).strict();
export type AssetSourceGraphicsRoomDeviceDefinition = z.infer<typeof AssetSourceGraphicsRoomDeviceDefinitionSchema>;

export const AssetSourceGraphicsInfoSchema = z.discriminatedUnion('type', [
	z.object({
		type: z.literal('worn'),
		definition: AssetSourceGraphicsDefinitionSchema,
		/** Map containing mappings between original image and image resource final name. */
		originalImagesMap: z.record(z.string(), z.string()),
	}),
	z.object({
		type: z.literal('roomDevice'),
		definition: AssetSourceGraphicsRoomDeviceDefinitionSchema,
		/** Map containing mappings between original image and image resource final name. */
		originalImagesMap: z.record(z.string(), z.string()),
	}),
]);
export type AssetSourceGraphicsInfo = z.infer<typeof AssetSourceGraphicsInfoSchema>;

export const GraphicsSourceDefinitionFileSchema = z.object({
	assets: z.record(AssetIdSchema, AssetSourceGraphicsInfoSchema),
	pointTemplates: z.record(z.string(), PointTemplateSourceSchema),
});

export type GraphicsSourceDefinitionFile = z.infer<typeof GraphicsSourceDefinitionFileSchema>;
