import type { Immutable } from 'immer';
import { type GraphicsLayer, type GraphicsSourceLayer, type LayerImageSetting } from 'pandora-common';
import { useObservable } from '../../observable.ts';
import { AssetGraphicsSourceMap } from './editorAssetGraphicsBuilding.ts';
import type { EditorAssetGraphicsLayer } from './editorAssetGraphicsLayer.ts';

export function useLayerName(layer: EditorAssetGraphicsLayer): string {
	const d = useObservable<Immutable<GraphicsSourceLayer>>(layer.definition);
	const name = d.name || `Layer #${layer.index + 1}`;
	return name;
}

export function useLayerHasAlphaMasks(layer: EditorAssetGraphicsLayer): boolean {
	return layer.type === 'alphaImageMesh';
}

export function useLayerImageSettingsForScalingStop(layer: EditorAssetGraphicsLayer<'mesh' | 'alphaImageMesh'>, stop: number | null | undefined): Immutable<LayerImageSetting> {
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
export function GetEditorSourceLayerForRuntimeLayer(layer: Immutable<GraphicsLayer>): EditorAssetGraphicsLayer | null {
	// It is safe to have this not as a hook, because we assume all layers are built from exactly one editor layer
	// and the sourcemap is set right after build, before anything has a chance to use the layer
	return AssetGraphicsSourceMap.get(layer) ?? null;
}
