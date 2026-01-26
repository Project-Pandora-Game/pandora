import { type Immutable } from 'immer';
import {
	type GraphicsSourceLayer,
	type GraphicsSourceLayerType,
	type GraphicsSourceRoomDeviceLayer,
	type GraphicsSourceRoomDeviceLayerType,
} from 'pandora-common';
import type { ReadonlyObservable } from '../../../observable.ts';
import type { EditorAssetGraphicsRoomDeviceLayer, EditorAssetGraphicsRoomDeviceLayerContainer } from '../editorAssetGraphicsRoomDeviceLayer.ts';
import type { EditorAssetGraphicsWornLayer, EditorAssetGraphicsWornLayerContainer } from '../editorAssetGraphicsWornLayer.ts';
import type { EditorAssetGraphics } from './editorAssetGraphics.ts';

export interface EditorWornLayersContainer {
	readonly assetGraphics: EditorAssetGraphics;
	readonly layers: ReadonlyObservable<readonly EditorAssetGraphicsWornLayer[]>;
	readonly roomLayers: ReadonlyObservable<EditorRoomLayersContainer | null>;

	addLayer(layer: GraphicsSourceLayerType | Immutable<GraphicsSourceLayer>, insertIndex?: number): EditorAssetGraphicsWornLayer;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	deleteLayer(layer: EditorAssetGraphicsWornLayerContainer<any>): void;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	moveLayerRelative(layer: EditorAssetGraphicsWornLayerContainer<any>, shift: number): void;
}

export interface EditorRoomLayersContainer {
	readonly assetGraphics: EditorAssetGraphics;
	readonly layers: ReadonlyObservable<readonly EditorAssetGraphicsRoomDeviceLayer[]>;

	addLayer(layer: GraphicsSourceRoomDeviceLayerType | Immutable<GraphicsSourceRoomDeviceLayer>, insertIndex?: number): EditorAssetGraphicsRoomDeviceLayer;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	deleteLayer(layer: EditorAssetGraphicsRoomDeviceLayerContainer<any>): void;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	moveLayerRelative(layer: EditorAssetGraphicsRoomDeviceLayerContainer<any>, shift: number): void;
}
