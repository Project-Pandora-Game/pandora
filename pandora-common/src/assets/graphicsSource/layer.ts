import * as z from 'zod';
import { GraphicsSourceAlphaImageMeshLayerSchema } from './layers/alphaImageMesh.ts';
import { GraphicsSourceAutoMeshLayerSchema } from './layers/autoMesh.ts';
import { GraphicsSourceMeshLayerSchema } from './layers/mesh.ts';
import { GraphicsSourceTextLayerSchema } from './layers/text.ts';

export const GraphicsSourceLayerSchema = z.discriminatedUnion('type', [
	GraphicsSourceMeshLayerSchema,
	GraphicsSourceAlphaImageMeshLayerSchema,
	GraphicsSourceAutoMeshLayerSchema,
	GraphicsSourceTextLayerSchema,
]);
export type GraphicsSourceLayer = z.infer<typeof GraphicsSourceLayerSchema>;
export type GraphicsSourceLayerType = GraphicsSourceLayer['type'];
