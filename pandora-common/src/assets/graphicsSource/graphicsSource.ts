import { z } from 'zod';
import { AssetIdSchema } from '../base.ts';
import { PointTemplateSchema } from '../graphics/points.ts';
import { GraphicsSourceLayerSchema } from './layer.ts';

export const AssetSourceGraphicsDefinitionSchema = z.object({
	layers: GraphicsSourceLayerSchema.array(),
}).strict();
export type AssetSourceGraphicsDefinition = z.infer<typeof AssetSourceGraphicsDefinitionSchema>;

export const GraphicsSourceDefinitionFileSchema = z.object({
	assets: z.record(AssetIdSchema, AssetSourceGraphicsDefinitionSchema),
	pointTemplates: z.record(z.string(), PointTemplateSchema),
});

export type GraphicsSourceDefinitionFile = z.infer<typeof GraphicsSourceDefinitionFileSchema>;
