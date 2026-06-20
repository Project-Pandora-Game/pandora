import * as z from 'zod';
import { GraphicsAlphaImageMeshLayerSchema, type GraphicsAlphaImageMeshLayer } from './layers/alphaImageMesh.ts';
import { GraphicsMeshLayerSchema, type GraphicsMeshLayer } from './layers/mesh.ts';
import { RoomDeviceGraphicsLayerMeshSchema, type RoomDeviceGraphicsLayerMesh } from './layers/roomDeviceMesh.ts';
import { RoomDeviceGraphicsLayerSlotSchema, type RoomDeviceGraphicsLayerSlot } from './layers/roomDeviceSlot.ts';
import { RoomDeviceGraphicsLayerSpriteSchema, type RoomDeviceGraphicsLayerSprite } from './layers/roomDeviceSprite.ts';
import { RoomDeviceGraphicsLayerTextSchema, type RoomDeviceGraphicsLayerText } from './layers/roomDeviceText.ts';
import { GraphicsTextLayerSchema, type GraphicsTextLayer } from './layers/text.ts';

export type GraphicsLayer =
	| GraphicsMeshLayer
	| GraphicsAlphaImageMeshLayer
	| GraphicsTextLayer;
export const GraphicsLayerSchema: z.ZodType<GraphicsLayer> = z.discriminatedUnion('type', [
	GraphicsMeshLayerSchema,
	GraphicsAlphaImageMeshLayerSchema,
	GraphicsTextLayerSchema,
]);
export type GraphicsLayerType = GraphicsLayer['type'];

export type RoomDeviceGraphicsLayer =
	| RoomDeviceGraphicsLayerSprite
	| RoomDeviceGraphicsLayerSlot
	| RoomDeviceGraphicsLayerText
	| RoomDeviceGraphicsLayerMesh;
export const RoomDeviceGraphicsLayerSchema: z.ZodType<RoomDeviceGraphicsLayer> = z.discriminatedUnion('type', [
	RoomDeviceGraphicsLayerSpriteSchema,
	RoomDeviceGraphicsLayerSlotSchema,
	RoomDeviceGraphicsLayerTextSchema,
	RoomDeviceGraphicsLayerMeshSchema,
]);
export type RoomDeviceGraphicsLayerType = RoomDeviceGraphicsLayer['type'];
