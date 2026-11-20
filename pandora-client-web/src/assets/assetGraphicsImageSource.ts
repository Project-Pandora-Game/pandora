import type { Immutable } from 'immer';
import {
	APPEARANCE_POSE_DEFAULT,
	ProduceAppearancePose,
	type AppearancePose,
	type AssetManager,
	type LayerImageOverride,
	type LayerImageSetting,
} from 'pandora-common';

export type LayerImageSource = Immutable<{
	setting: LayerImageSetting;
	image: string;
	normalMapImage?: string;
	imageUvPose: AppearancePose;
}>;

type ImageSetting = Immutable<LayerImageSetting>;
type SelectedImage = Immutable<LayerImageSetting | LayerImageOverride>;
const resolvedSources = new WeakMap<AssetManager, WeakMap<ImageSetting, WeakMap<SelectedImage, LayerImageSource>>>();

/** The UV pose belongs to the selected image definition, not the moving character pose. */
export function ResolveLayerImageSource(assetManager: AssetManager, setting: ImageSetting, selected: SelectedImage): LayerImageSource {
	let settings = resolvedSources.get(assetManager);
	if (settings === undefined) {
		settings = new WeakMap();
		resolvedSources.set(assetManager, settings);
	}
	let selections = settings.get(setting);
	if (selections === undefined) {
		selections = new WeakMap();
		settings.set(setting, selections);
	}
	let result = selections.get(selected);
	if (result === undefined) {
		result = {
			setting,
			image: selected.image,
			normalMapImage: selected.normalMapImage,
			imageUvPose: selected.uvPose ? ProduceAppearancePose(APPEARANCE_POSE_DEFAULT, { assetManager }, selected.uvPose) : APPEARANCE_POSE_DEFAULT,
		};
		selections.set(selected, result);
	}
	return result;
}
