import { z } from 'zod';
import { RectangleSchema } from '../../graphics/common.ts';
import { LayerImageOverrideSchema, LayerMirrorSchema, LayerPrioritySchema } from '../../graphics/layers/common.ts';

export const GraphicsSourceAutoMeshTemplateSchema = z.object({
	name: z.string(),
	points: z.string(),
	parts: z.object({
		id: z.string(),
		priority: LayerPrioritySchema,
		pointType: z.string().array().optional(),
		mirror: LayerMirrorSchema.optional(),
	}).array(),
});
export type GraphicsSourceAutoMeshTemplate = z.infer<typeof GraphicsSourceAutoMeshTemplateSchema>;

export const GraphicsSourceAutoMeshGraphicalLayerSchema = z.object({
	name: z.string(),
	colorizationKey: z.string().optional(),
	imageOverrides: LayerImageOverrideSchema.array().optional(),
});
export type GraphicsSourceAutoMeshGraphicalLayer = z.infer<typeof GraphicsSourceAutoMeshGraphicalLayerSchema>;

export const GraphicsSourceAutoMeshLayerVariableSchema = z.discriminatedUnion('type', [
	z.object({
		type: z.literal('typedModule'),
		module: z.string(),
	}),
]);
export type GraphicsSourceAutoMeshLayerVariable = z.infer<typeof GraphicsSourceAutoMeshLayerVariableSchema>;

export const GraphicsSourceAutoMeshLayerSchema = RectangleSchema.extend({
	type: z.literal('autoMesh'),
	name: z.string(),
	automeshTemplate: z.string(),
	disabledTemplateParts: z.string().array().optional(),
	graphicalLayers: GraphicsSourceAutoMeshGraphicalLayerSchema.array(),
	variables: GraphicsSourceAutoMeshLayerVariableSchema.array(),

	imageMap: z.record(z.string(), z.string().array()),
}).strict();
export type GraphicsSourceAutoMeshLayer = z.infer<typeof GraphicsSourceAutoMeshLayerSchema>;
