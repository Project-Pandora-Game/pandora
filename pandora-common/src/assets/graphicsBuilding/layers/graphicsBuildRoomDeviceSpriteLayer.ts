import { type Immutable } from 'immer';
import type { Logger } from '../../../logging/logger.ts';
import { Assert, CloneDeepMutable } from '../../../utility/misc.ts';
import type { LayerImageOverride } from '../../graphics/layers/common.ts';
import type { RoomDeviceGraphicsLayerSprite } from '../../graphics/layers/roomDeviceSprite.ts';
import type { GraphicsSourceRoomDeviceLayerSprite } from '../../graphicsSource/index.ts';
import type { GraphicsBuildContext, GraphicsBuildContextRoomDeviceData } from '../graphicsBuildContext.ts';
import { LoadLayerImage, type LayerImageTrimArea } from '../graphicsBuildImageResource.ts';

export async function LoadAssetRoomDeviceSpriteLayer(
	layer: Immutable<GraphicsSourceRoomDeviceLayerSprite>,
	context: GraphicsBuildContext<Immutable<GraphicsBuildContextRoomDeviceData>>,
	logger: Logger,
): Promise<Immutable<RoomDeviceGraphicsLayerSprite[]>> {
	logger = logger.prefixMessages(`[Layer ${layer.name || '[unnamed]'}]`);

	const images = Array.from(new Set<string>([
		layer.image,
		...(layer.imageOverrides?.map((override) => override.image) ?? []),
	]
		.filter(Boolean),
	));

	let imageTrimArea: LayerImageTrimArea = null;
	if (!context.generateOptimizedTextures) {
		// NOOP
	} else {
		Assert(context.runImageBasedChecks, 'generateOptimizedTextures should only be used with runImageBasedChecks');

		// Get all the image's bounding boxes for this layer
		const boundingBoxes = await Promise.all(images.map((i) => context.loadImage(i).getContentBoundingBox()));
		// Calculate total image bounding boxes
		const imageBoundingBox: LayerImageTrimArea = [1, 1, 0, 0]; // left, top, rightExclusive, bottomExclusive
		for (const image of boundingBoxes) {
			if (image.width === 0 || image.height === 0)
				continue;
			imageBoundingBox[0] = Math.min(imageBoundingBox[0], image.left / image.width);
			imageBoundingBox[1] = Math.min(imageBoundingBox[1], image.top / image.height);
			imageBoundingBox[2] = Math.max(imageBoundingBox[2], image.rightExclusive / image.width);
			imageBoundingBox[3] = Math.max(imageBoundingBox[3], image.bottomExclusive / image.height);
		}

		if (!(imageBoundingBox[0] < imageBoundingBox[2]) || !(imageBoundingBox[1] < imageBoundingBox[3])) {
			logger.warning('All layer\'s images are empty. This will produce empty mesh.');
			imageBoundingBox[0] = 0;
			imageBoundingBox[1] = 0;
		}

		// Use image bounding box as trim area, scaled to the original layer size.
		// There are no points to consider in this layer type
		imageTrimArea = [
			Math.floor(imageBoundingBox[0] * layer.width),
			Math.floor(imageBoundingBox[1] * layer.height),
			Math.ceil(imageBoundingBox[2] * layer.width),
			Math.ceil(imageBoundingBox[3] * layer.height),
		];

		// Check against bad conditions
		Assert(imageTrimArea[0] >= 0);
		Assert(imageTrimArea[0] <= layer.width);
		Assert(imageTrimArea[1] >= 0);
		Assert(imageTrimArea[1] <= layer.height);
		Assert(imageTrimArea[2] >= 0);
		Assert(imageTrimArea[2] <= layer.width);
		Assert(imageTrimArea[3] >= 0);
		Assert(imageTrimArea[3] <= layer.height);

		if (!(imageTrimArea[0] < imageTrimArea[2])) {
			logger.warning('Trim area has non-positive width. Does the layer have no non-empty images?');
			imageTrimArea = null;
		} else if (!(imageTrimArea[1] < imageTrimArea[3])) {
			logger.warning('Trim area has non-positive height. Does the layer have no non-empty images?');
			imageTrimArea = null;
		} else if (!context.generateOptimizedTextures) {
			imageTrimArea = null;
		}
	}

	const normalizedImageTrimArea: LayerImageTrimArea = imageTrimArea != null ? [
		imageTrimArea[0] / layer.width,
		imageTrimArea[1] / layer.height,
		imageTrimArea[2] / layer.width,
		imageTrimArea[3] / layer.height,
	] : null;

	const result: RoomDeviceGraphicsLayerSprite = {
		x: layer.x,
		y: layer.y,
		width: layer.width,
		height: layer.height,
		type: 'sprite',
		image: layer.image && LoadLayerImage(layer.image, context, normalizedImageTrimArea),
		imageOverrides: layer.imageOverrides?.map((override): LayerImageOverride => ({
			...CloneDeepMutable(override),
			image: override.image && LoadLayerImage(override.image, context, normalizedImageTrimArea),
		})),
		colorizationKey: layer.colorizationKey,
		offsetOverrides: CloneDeepMutable(layer.offsetOverrides),
		clipToRoom: layer.clipToRoom,
	};

	// Adjust layer size if we trimmed it down
	if (imageTrimArea != null) {
		const left = imageTrimArea[0];
		const top = imageTrimArea[1];
		result.x += left;
		result.y += top;

		result.width = imageTrimArea[2] - left;
		result.height = imageTrimArea[3] - top;
	}

	if (result.colorizationKey != null && !context.builtAssetData.colorizationKeys.has(result.colorizationKey)) {
		logger.warning(`colorizationKey ${result.colorizationKey} outside of defined colorization keys [${[...context.builtAssetData.colorizationKeys].join(', ')}]`);
	}

	return Promise.resolve<RoomDeviceGraphicsLayerSprite[]>([result]);
}
