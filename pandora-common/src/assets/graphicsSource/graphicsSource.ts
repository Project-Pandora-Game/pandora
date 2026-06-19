import * as z from 'zod';
import { AssetIdSchema, type AssetId } from '../base.ts';
import { PointTemplateSourceSchema, type PointTemplateSource } from '../graphics/points.ts';
import { GraphicsSourceLayerSchema, GraphicsSourceRoomDeviceLayerSchema, type GraphicsSourceLayer, type GraphicsSourceRoomDeviceLayer } from './layer.ts';

export interface AssetSourceGraphicsDefinition {
	layers: GraphicsSourceLayer[];
	/** The graphics that is used when the item can be (and is) deployed in a room. */
	roomLayers?: GraphicsSourceRoomDeviceLayer[];
}
export const AssetSourceGraphicsDefinitionSchema: z.ZodType<AssetSourceGraphicsDefinition> = z.object({
	layers: GraphicsSourceLayerSchema.array(),
	roomLayers: GraphicsSourceRoomDeviceLayerSchema.array().optional(),
}).strict();

export interface AssetSourceGraphicsRoomDeviceSlotDefinition {
	layers: GraphicsSourceLayer[];
}
export const AssetSourceGraphicsRoomDeviceSlotDefinitionSchema: z.ZodType<AssetSourceGraphicsRoomDeviceSlotDefinition> = z.object({
	layers: GraphicsSourceLayerSchema.array(),
});

export interface AssetSourceGraphicsRoomDeviceDefinition {
	/** The graphical display of the device */
	layers: GraphicsSourceRoomDeviceLayer[];
	slots: Record<string, AssetSourceGraphicsRoomDeviceSlotDefinition>;
}
export const AssetSourceGraphicsRoomDeviceDefinitionSchema: z.ZodType<AssetSourceGraphicsRoomDeviceDefinition> = z.object({
	layers: GraphicsSourceRoomDeviceLayerSchema.array(),
	slots: z.record(z.string(), AssetSourceGraphicsRoomDeviceSlotDefinitionSchema),
}).strict();

export type AssetSourceGraphicsInfo =
	| {
		type: 'worn';
		definition: AssetSourceGraphicsDefinition;
		/** Map containing mappings between original image and image resource final name. */
		originalImagesMap: Record<string, string>;
	}
	| {
		type: 'roomDevice';
		definition: AssetSourceGraphicsRoomDeviceDefinition;
		/** Map containing mappings between original image and image resource final name. */
		originalImagesMap: Record<string, string>;
	};
export const AssetSourceGraphicsInfoSchema: z.ZodType<AssetSourceGraphicsInfo> = z.discriminatedUnion('type', [
	z.object({
		type: z.literal('worn'),
		definition: AssetSourceGraphicsDefinitionSchema,
		originalImagesMap: z.record(z.string(), z.string()),
	}),
	z.object({
		type: z.literal('roomDevice'),
		definition: AssetSourceGraphicsRoomDeviceDefinitionSchema,
		originalImagesMap: z.record(z.string(), z.string()),
	}),
]);

export interface GraphicsSourceDefinitionFile {
	assets: Record<AssetId, AssetSourceGraphicsInfo>;
	pointTemplates: Record<string, PointTemplateSource>;
}
export const GraphicsSourceDefinitionFileSchema: z.ZodType<GraphicsSourceDefinitionFile> = z.object({
	assets: z.record(AssetIdSchema, AssetSourceGraphicsInfoSchema),
	pointTemplates: z.record(z.string(), PointTemplateSourceSchema),
});
