import { produce, type Immutable } from 'immer';
import { LayerMirror, MirrorBoneLike, MirrorLayerImageSetting, type AssetGraphicsDefinition, type GraphicsLayer } from 'pandora-common';
import { MirrorPriority } from '../graphics/def.ts';

export interface LoadedAssetGraphics {
	layers: readonly Immutable<GraphicsLayer>[];
	originalLayers: readonly Immutable<GraphicsLayer>[];
}

function LoadAssetGraphicsLayer(layer: Immutable<GraphicsLayer>): Immutable<GraphicsLayer>[] {
	let mirror: Immutable<GraphicsLayer> | undefined;

	if (layer.mirror !== LayerMirror.NONE) {
		mirror = produce(layer, (d) => {
			d.priority = MirrorPriority(d.priority);
			d.pointType = d.pointType?.map(MirrorBoneLike);
			d.image = MirrorLayerImageSetting(d.image);
			d.scaling = d.scaling && {
				...d.scaling,
				stops: d.scaling.stops.map((stop) => [stop[0], MirrorLayerImageSetting(stop[1])]),
			};
		});
	}

	return mirror ? [layer, mirror] : [layer];
}

export function LoadAssetGraphics(data: Immutable<AssetGraphicsDefinition>): LoadedAssetGraphics {
	return {
		layers: data.layers.flatMap((l) => LoadAssetGraphicsLayer(l)),
		originalLayers: data.layers,
	};
}
