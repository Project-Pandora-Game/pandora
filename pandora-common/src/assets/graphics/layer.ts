import * as z from 'zod';
import { GraphicsAlphaImageMeshLayerSchema } from './layers/alphaImageMesh.ts';
import { GraphicsMeshLayerSchema } from './layers/mesh.ts';
import { RoomDeviceGraphicsLayerMeshSchema } from './layers/roomDeviceMesh.ts';
import { RoomDeviceGraphicsLayerSlotSchema } from './layers/roomDeviceSlot.ts';
import { RoomDeviceGraphicsLayerSpriteSchema } from './layers/roomDeviceSprite.ts';
import { RoomDeviceGraphicsLayerTextSchema } from './layers/roomDeviceText.ts';
import { GraphicsTextLayerSchema } from './layers/text.ts';

export const GraphicsLayerSchema = z.discriminatedUnion('type', [
	GraphicsMeshLayerSchema,
	GraphicsAlphaImageMeshLayerSchema,
	GraphicsTextLayerSchema,
]);
export type GraphicsLayer = z.infer<typeof GraphicsLayerSchema>;
export type GraphicsLayerType = GraphicsLayer['type'];

export const RoomDeviceGraphicsLayerSchema = z.discriminatedUnion('type', [
	RoomDeviceGraphicsLayerSpriteSchema,
	RoomDeviceGraphicsLayerSlotSchema,
	RoomDeviceGraphicsLayerTextSchema,
	RoomDeviceGraphicsLayerMeshSchema,
]);
export type RoomDeviceGraphicsLayer = z.infer<typeof RoomDeviceGraphicsLayerSchema>;
export type RoomDeviceGraphicsLayerType = RoomDeviceGraphicsLayer['type'];
