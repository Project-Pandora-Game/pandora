import type { Immutable } from 'immer';
import { AssertNever, type GraphicsLayer, type GraphicsSourceLayer, type GraphicsSourceRoomDeviceLayer, type LayerImageSetting } from 'pandora-common';
import { useObservable } from '../../observable.ts';
import { AssetGraphicsWornSourceMap } from './editorAssetGraphicsBuilding.ts';
import { EditorAssetGraphicsRoomDeviceLayerContainer, type EditorAssetGraphicsRoomDeviceLayer } from './editorAssetGraphicsRoomDeviceLayer.ts';
import { EditorAssetGraphicsWornLayerContainer, type EditorAssetGraphicsWornLayer } from './editorAssetGraphicsWornLayer.ts';

export function useLayerName(layer: EditorAssetGraphicsWornLayer | EditorAssetGraphicsRoomDeviceLayer): string {
	const d = useObservable<Immutable<GraphicsSourceLayer> | Immutable<GraphicsSourceRoomDeviceLayer>>(layer.definition);
	const name = d.name || `Layer #${layer.index + 1}`;
	return name;
}

export function useLayerHasAlphaMasks(layer: EditorAssetGraphicsWornLayer | EditorAssetGraphicsRoomDeviceLayer): boolean {
	const d = useObservable<Immutable<GraphicsSourceLayer> | Immutable<GraphicsSourceRoomDeviceLayer>>(layer.definition);
	if (layer instanceof EditorAssetGraphicsWornLayerContainer) {
		const dWorn = d as Immutable<GraphicsSourceLayer>;
		return dWorn.type === 'alphaImageMesh';
	} else if (layer instanceof EditorAssetGraphicsRoomDeviceLayerContainer) {
		const dRoomDevice = d as Immutable<GraphicsSourceRoomDeviceLayer>;
		return (dRoomDevice.type === 'sprite' && dRoomDevice.clipToRoom === true) ||
			(dRoomDevice.type === 'mesh' && dRoomDevice.clipToRoom === true);
	}
	AssertNever(layer);
}

export function useLayerImageSettingsForScalingStop(layer: EditorAssetGraphicsWornLayer<'mesh' | 'alphaImageMesh'>, stop: number | null | undefined): Immutable<LayerImageSetting> {
	const d = useObservable(layer.definition);
	if (!stop)
		return d.image;

	const res = d.scaling?.stops.find((s) => s[0] === stop)?.[1];
	if (!res) {
		throw new Error('Failed to get stop');
	}
	return res;
}

/** Attempt to resolve an runtime layer to originating editor source layer. */
export function GetEditorSourceLayerForRuntimeLayer(layer: Immutable<GraphicsLayer>): EditorAssetGraphicsWornLayer | null {
	// It is safe to have this not as a hook, because we assume all layers are built from exactly one editor layer
	// and the sourcemap is set right after build, before anything has a chance to use the layer
	return AssetGraphicsWornSourceMap.get(layer) ?? null;
}
