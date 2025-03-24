import type { Immutable } from 'immer';
import type { GraphicsBuildContext } from './graphicsBuildContext.ts';
import type { LayerImageOverride, LayerImageSetting } from '../graphics/layers/common.ts';
import { CloneDeepMutable } from '../../utility/misc.ts';

export type LayerImageTrimArea = [left: number, top: number, right: number, bottom: number] | null;

export interface ImageBoundingBox {
	left: number;
	top: number;
	rightExclusive: number;
	bottomExclusive: number;
	width: number;
	height: number;
}

export interface GraphicsBuildImageResource {
	readonly resultName: string;

	/**
	 * Cut part of the image. Coordinates should be passed in range [0, 1] and will be sized relative to the image size.
	 */
	addCutImageRelative(left: number, top: number, right: number, bottom: number): GraphicsBuildImageResource;

	addResizedImage(maxWidth: number, maxHeight: number, suffix: string): GraphicsBuildImageResource;
	addDownscaledImage(resolution: number): GraphicsBuildImageResource;
	addSizeCheck(exactWidth: number, exactHeight: number): void;

	getContentBoundingBox(): Promise<ImageBoundingBox>;
}

export function LoadLayerImage(image: string, context: GraphicsBuildContext, imageTrimArea: LayerImageTrimArea): string {
	let resource = context.loadImage(image);

	if (imageTrimArea != null) {
		resource = resource.addCutImageRelative(imageTrimArea[0], imageTrimArea[1], imageTrimArea[2], imageTrimArea[3]);
	}

	for (const resolution of context.generateResolutions) {
		resource.addDownscaledImage(resolution);
	}

	return resource.resultName;
}

export function ListLayerImageSettingImages(setting: Immutable<LayerImageSetting>, context: GraphicsBuildContext): GraphicsBuildImageResource[] {
	const resources = new Set<GraphicsBuildImageResource>();

	setting.overrides.forEach(({ image }) => {
		if (image) {
			resources.add(context.loadImage(image));
		}
	});

	if (setting.image) {
		resources.add(context.loadImage(setting.image));
	}

	return Array.from(resources);
}

export function LoadLayerImageSetting(setting: Immutable<LayerImageSetting>, context: GraphicsBuildContext, imageTrimArea: LayerImageTrimArea): LayerImageSetting {
	const overrides: LayerImageOverride[] = setting.overrides
		.map((override): LayerImageOverride => ({
			image: override.image && LoadLayerImage(override.image, context, imageTrimArea),
			uvPose: override.uvPose,
			condition: CloneDeepMutable(override.condition),
		}));
	return {
		...setting,
		image: setting.image && LoadLayerImage(setting.image, context, imageTrimArea),
		overrides,
	};
}
