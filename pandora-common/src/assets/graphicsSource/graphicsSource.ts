import { z } from 'zod';
import { AssetIdSchema } from '../base.ts';
import { PointTemplateSourceSchema } from '../graphics/points.ts';
import { GraphicsSourceLayerSchema } from './layer.ts';
import { GraphicsSourceAutoMeshTemplateSchema } from './layers/autoMesh.ts';

export const AssetSourceGraphicsDefinitionSchema = z.object({
	layers: GraphicsSourceLayerSchema.array(),
}).strict();
export type AssetSourceGraphicsDefinition = z.infer<typeof AssetSourceGraphicsDefinitionSchema>;

export const AssetSourceGraphicsInfoSchema = z.object({
	definition: AssetSourceGraphicsDefinitionSchema,
	/** Map containing mappings between original image and image resource final name. */
	originalImagesMap: z.record(z.string(), z.string()),
});
export type AssetSourceGraphicsInfo = z.infer<typeof AssetSourceGraphicsInfoSchema>;

export const GraphicsSourceDefinitionFileSchema = z.object({
	assets: z.record(AssetIdSchema, AssetSourceGraphicsInfoSchema),
	pointTemplates: z.record(z.string(), PointTemplateSourceSchema),
	automeshTemplates: z.record(z.string(), GraphicsSourceAutoMeshTemplateSchema),
});

export type GraphicsSourceDefinitionFile = z.infer<typeof GraphicsSourceDefinitionFileSchema>;
