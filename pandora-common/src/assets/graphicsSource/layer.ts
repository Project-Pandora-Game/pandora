import * as z from 'zod';
import { GraphicsSourceAlphaImageMeshLayerSchema, type GraphicsSourceAlphaImageMeshLayer } from './layers/alphaImageMesh.ts';
import { GraphicsSourceAutoMeshLayerSchema, type GraphicsSourceAutoMeshLayer } from './layers/autoMesh.ts';
import { GraphicsSourceMeshLayerSchema, type GraphicsSourceMeshLayer } from './layers/mesh.ts';
import { GraphicsSourceRoomDeviceAutoSpriteLayerSchema, type GraphicsSourceRoomDeviceAutoSpriteLayer } from './layers/roomDeviceAutoSprite.ts';
import { GraphicsSourceRoomDeviceLayerMeshSchema, type GraphicsSourceRoomDeviceLayerMesh } from './layers/roomDeviceMesh.ts';
import { GraphicsSourceRoomDeviceLayerSlotSchema, type GraphicsSourceRoomDeviceLayerSlot } from './layers/roomDeviceSlot.ts';
import { GraphicsSourceRoomDeviceLayerSpriteSchema, type GraphicsSourceRoomDeviceLayerSprite } from './layers/roomDeviceSprite.ts';
import { GraphicsSourceRoomDeviceLayerTextSchema, type GraphicsSourceRoomDeviceLayerText } from './layers/roomDeviceText.ts';
import { GraphicsSourceTextLayerSchema, type GraphicsSourceTextLayer } from './layers/text.ts';

export type GraphicsSourceLayer =
	| GraphicsSourceMeshLayer
	| GraphicsSourceAlphaImageMeshLayer
	| GraphicsSourceAutoMeshLayer
	| GraphicsSourceTextLayer;
export const GraphicsSourceLayerSchema: z.ZodType<GraphicsSourceLayer> = z.discriminatedUnion('type', [
	GraphicsSourceMeshLayerSchema,
	GraphicsSourceAlphaImageMeshLayerSchema,
	GraphicsSourceAutoMeshLayerSchema,
	GraphicsSourceTextLayerSchema,
]);
export type GraphicsSourceLayerType = GraphicsSourceLayer['type'];

export type GraphicsSourceRoomDeviceLayer =
	| GraphicsSourceRoomDeviceLayerSprite
	| GraphicsSourceRoomDeviceAutoSpriteLayer
	| GraphicsSourceRoomDeviceLayerSlot
	| GraphicsSourceRoomDeviceLayerText
	| GraphicsSourceRoomDeviceLayerMesh;
export const GraphicsSourceRoomDeviceLayerSchema: z.ZodType<GraphicsSourceRoomDeviceLayer> = z.discriminatedUnion('type', [
	GraphicsSourceRoomDeviceLayerSpriteSchema,
	GraphicsSourceRoomDeviceAutoSpriteLayerSchema,
	GraphicsSourceRoomDeviceLayerSlotSchema,
	GraphicsSourceRoomDeviceLayerTextSchema,
	GraphicsSourceRoomDeviceLayerMeshSchema,
]);
export type GraphicsSourceRoomDeviceLayerType = GraphicsSourceRoomDeviceLayer['type'];
