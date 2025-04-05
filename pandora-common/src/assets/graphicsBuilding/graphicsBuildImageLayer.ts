import { produce, type Immutable } from 'immer';
import type { Logger } from '../../logging/logger.ts';
import { BitField } from '../../utility/bitfield.ts';
import { Assert, CloneDeepMutable, EMPTY_ARRAY } from '../../utility/misc.ts';
import type { GraphicsAlphaImageMeshLayer } from '../graphics/layers/alphaImageMesh.ts';
import { LayerMirror, MirrorPriority } from '../graphics/layers/common.ts';
import type { GraphicsMeshLayer } from '../graphics/layers/mesh.ts';
import { MakeMirroredPoints, MirrorBoneLike, MirrorLayerImageSetting, type PointDefinitionCalculated } from '../graphics/mirroring.ts';
import { ALWAYS_ALLOWED_LAYER_PRIORITIES } from '../graphics/points.ts';
import type { GraphicsSourceAlphaImageMeshLayer } from '../graphicsSource/layers/alphaImageMesh.ts';
import type { GraphicsSourceMeshLayer } from '../graphicsSource/layers/mesh.ts';
import type { GraphicsBuildContext } from './graphicsBuildContext.ts';
import { ListLayerImageSettingImages, LoadLayerImageSetting, type LayerImageTrimArea } from './graphicsBuildImageResource.ts';
import { TriangleRectangleOverlap } from './math/intersections.ts';
import { CalculatePointsTriangles } from './math/triangulation.ts';

async function LoadAssetImageLayerSingle(
	layer: Immutable<GraphicsSourceMeshLayer> | Immutable<GraphicsSourceAlphaImageMeshLayer>,
	context: GraphicsBuildContext,
	logger: Logger,
): Promise<Immutable<GraphicsMeshLayer | GraphicsAlphaImageMeshLayer>> {
	const pointTemplate = context.getPointTemplate(layer.points);

	if (pointTemplate == null) {
		throw new Error(`Layer ${layer.name ?? '[unnamed]'} refers to unknown template '${layer.points}'`);
	}

	// Check if the image has any UV pose manipulation or not
	let hasUvManipulation: boolean = false;
	if (layer.scaling != null) {
		hasUvManipulation = true;
		if (layer.scaling.stops.length === 0) {
			logger.warning(`Has scaling enabled, but no scaling stops. Disable the scaling altogether if it isn't needed`);
		}
	}
	if (layer.image.uvPose != null) {
		hasUvManipulation = true;
	}
	for (const imageOverride of layer.image.overrides) {
		if (imageOverride.uvPose != null) {
			hasUvManipulation = true;
		}
	}

	let layerPointFilterMask: string | undefined;
	let imageTrimArea: LayerImageTrimArea = null;
	if (!context.runImageBasedChecks && !context.generateOptimizedTextures) {
		// NOOP
	} else if (hasUvManipulation) {
		logger.debug('Layer has UV manipulation, skipping texture optimization');
	} else {
		Assert(context.runImageBasedChecks, 'generateOptimizedTextures should only be used with runImageBasedChecks');
		// Get all the images and their bounding boxes for this layer
		const images = Array.from(new Set([
			...ListLayerImageSettingImages(layer.image, context),
			...(layer.scaling ? layer.scaling.stops.flatMap((stop) => ListLayerImageSettingImages(stop[1], context)) : []),
		]));
		const boundingBoxes = await Promise.all(images.map((i) => i.getContentBoundingBox()));
		// Calculate total image bounding boxes
		const imageBoundingBox = [1, 1, 0, 0]; // left, top, rightExclusive, bottomExclusive
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

		// Calculate the actual points first (such as resolving mirrored points)
		const calculatedPoints: Immutable<PointDefinitionCalculated[]> = pointTemplate.points
			.map((point, index): PointDefinitionCalculated => ({
				...CloneDeepMutable(point),
				index,
				isMirror: false,
			}))
			.flatMap(MakeMirroredPoints);

		// Calculate point type filter
		const pointTypeFilter = new BitField(calculatedPoints.length);
		for (let i = 0; i < calculatedPoints.length; i++) {
			pointTypeFilter.set(i, layer.pointType == null || layer.pointType.includes(calculatedPoints[i].pointType));
		}

		// Generate the mesh triangles
		const triangles = CalculatePointsTriangles(calculatedPoints, pointTypeFilter);

		// Calculate which points are relevant to the image, excluding those that aren't
		const pointFilter = new BitField(calculatedPoints.length);
		{
			// Rectangle corners for nicer calculation
			const x1 = Math.floor(layer.x + imageBoundingBox[0] * layer.width);
			const y1 = Math.floor(layer.y + imageBoundingBox[1] * layer.height);
			const x2 = Math.ceil(layer.x + imageBoundingBox[2] * layer.width) - 1;
			const y2 = Math.ceil(layer.y + imageBoundingBox[3] * layer.height) - 1;

			// For each triangle determinate if it has intersection with the rectangle
			for (const [a, b, c] of triangles) {
				if (TriangleRectangleOverlap([calculatedPoints[a].pos, calculatedPoints[b].pos, calculatedPoints[c].pos], [x1, y1, x2, y2])) {
					pointFilter.set(a, true);
					pointFilter.set(b, true);
					pointFilter.set(c, true);

					// All the points above should have already passed point type filter to reach this place
					Assert(pointTypeFilter.get(a));
					Assert(pointTypeFilter.get(b));
					Assert(pointTypeFilter.get(c));
				}
			}
		}

		// Check if the point filter needs to be saved
		let layerPointFilterMaskNeedsSave = false;
		for (let i = 0; i < calculatedPoints.length; i++) {
			if (pointTypeFilter.get(i) !== pointFilter.get(i)) {
				layerPointFilterMaskNeedsSave = true;
				break;
			}
		}
		if (layerPointFilterMaskNeedsSave && context.generateOptimizedTextures) {
			layerPointFilterMask = context.bufferToBase64(pointFilter.buffer);
		}

		// Calculate bounding box of remaining points
		// Inverse values by default, as we go through points
		imageTrimArea = [layer.width, layer.height, 0, 0]; // left, top, rightExclusive, bottomExclusive

		for (let i = 0; i < calculatedPoints.length; i++) {
			const point = calculatedPoints[i];
			// Filter points based on previous findings
			if (!pointFilter.get(i))
				continue;

			// Remap point to layerspace
			const x = (point.pos[0] - (layer.x));
			const y = (point.pos[1] - (layer.y));
			// Recalculate minimums and maximums found
			imageTrimArea[0] = Math.min(imageTrimArea[0], x); // left
			imageTrimArea[1] = Math.min(imageTrimArea[1], y); // top
			imageTrimArea[2] = Math.max(imageTrimArea[2], x); // right
			imageTrimArea[3] = Math.max(imageTrimArea[3], y); // bottom
		}
		// Check against bad conditions
		Assert(imageTrimArea[0] <= layer.width);
		Assert(imageTrimArea[1] <= layer.height);
		Assert(imageTrimArea[2] >= 0);
		Assert(imageTrimArea[3] >= 0);

		if (!(imageTrimArea[0] < imageTrimArea[2])) {
			logger.warning('Trim area has non-positive width. Does the layer have no useful triangles?');
			imageTrimArea = null;
		} else if (!(imageTrimArea[1] < imageTrimArea[3])) {
			logger.warning('Trim area has non-positive height. Does the layer have no useful triangles?');
			imageTrimArea = null;
		} else if (imageTrimArea[0] < 0 || imageTrimArea[1] < 0 || imageTrimArea[2] > layer.width || imageTrimArea[3] > layer.height) {
			// TODO: Un-silence this once current problems are fixed
			// logger.warning(
			//    'Layer does not cover the used part of the mesh. This might cause graphical glitches.\n' +
			//    '\tOverflow:\n' +
			//    (imageTrimArea[0] < 0 ? `\t\tLeft: ${-imageTrimArea[0]}\n` : '') +
			//    (imageTrimArea[1] < 0 ? `\t\tTop: ${-imageTrimArea[1]}\n` : '') +
			//    (imageTrimArea[2] > layer.width ? `\t\tRight: ${(imageTrimArea[2] - layer.width)}\n` : '') +
			//    (imageTrimArea[3] > layer.height ? `\t\tBottom: ${(imageTrimArea[3] - layer.height)}\n` : ''),
			// );
			imageTrimArea = null;
		} else if (!context.generateOptimizedTextures) {
			imageTrimArea = null;
		}

		// Collect point types that are actually used
		const usedPointTypes = new Set<string>();
		for (let i = 0; i < calculatedPoints.length; i++) {
			const point = calculatedPoints[i];
			if (!pointFilter.get(i))
				continue;

			usedPointTypes.add(point.pointType);
		}

		// Collect required point types
		for (const matchedPointType of usedPointTypes) {
			const pointTypeMetadata = pointTemplate.pointTypes[matchedPointType];
			if (pointTypeMetadata == null)
				continue; // This is a point template error and is already reported by point template validation

			for (const requiredType of (pointTypeMetadata.requiredPointTypes ?? EMPTY_ARRAY)) {
				usedPointTypes.add(requiredType);

				if (layer.pointType != null && !layer.pointType.includes(requiredType)) {
					logger.warning(`Layer that uses point type '${matchedPointType}' should also enable point type '${requiredType}'.`);
				}
			}
		}

		// Validate that layer actually uses its declared point types
		if (layer.pointType != null) {
			for (const layerPointType of layer.pointType) {
				if (!usedPointTypes.has(layerPointType)) {
					logger.warning(`Layer declares usage of point type '${layerPointType}', but it is not actually used.`);
				}
			}
		}

		// Validate point types against the layer priority they should be used with
		for (const matchedPointType of usedPointTypes) {
			const pointTypeMetadata = pointTemplate.pointTypes[matchedPointType];
			if (pointTypeMetadata == null)
				continue; // This is a point template error and is already reported by point template validation

			if (pointTypeMetadata.allowedPriorities !== '*' &&
				!pointTypeMetadata.allowedPriorities.includes(layer.priority) &&
				!ALWAYS_ALLOWED_LAYER_PRIORITIES.includes(layer.priority)
			) {
				logger.warning(
					`Layer uses point type '${matchedPointType}' of template '${layer.points}', but this combination doesn't allow using priority '${layer.priority}'.\n\t` +
					`Filter out this point type or use one of allowed priorities: ${pointTypeMetadata.allowedPriorities.concat(ALWAYS_ALLOWED_LAYER_PRIORITIES).join(', ')}`,
				);
			}
		}
	}

	const normalizedImageTrimArea: LayerImageTrimArea = imageTrimArea != null ? [
		imageTrimArea[0] / layer.width,
		imageTrimArea[1] / layer.height,
		imageTrimArea[2] / layer.width,
		imageTrimArea[3] / layer.height,
	] : null;

	const result: GraphicsMeshLayer | GraphicsAlphaImageMeshLayer = {
		x: layer.x,
		y: layer.y,
		width: layer.width,
		height: layer.height,
		type: layer.type,
		priority: layer.priority,
		points: layer.points,
		pointType: layer.pointType?.slice(),
		pointFilterMask: layerPointFilterMask,
		image: LoadLayerImageSetting(layer.image, context, normalizedImageTrimArea),
		scaling: layer.scaling && {
			scaleBone: layer.scaling.scaleBone,
			stops: layer.scaling.stops.map((stop) => [stop[0], LoadLayerImageSetting(stop[1], context, normalizedImageTrimArea)]),
		},
	};

	// Some properties only exist for mesh layer
	if (layer.type === 'mesh') {
		Assert(result.type === 'mesh');
		result.previewOverrides = layer.previewOverrides;
		result.colorizationKey = layer.colorizationKey;
	}

	// Adjust layer size of we trimmed it down
	if (imageTrimArea != null) {
		const left = imageTrimArea[0];
		const top = imageTrimArea[1];
		result.x += left;
		result.y += top;

		result.width = imageTrimArea[2] - left;
		result.height = imageTrimArea[3] - top;
	}

	return result;
}

export async function LoadAssetImageLayer(
	layer: Immutable<GraphicsSourceMeshLayer> | Immutable<GraphicsSourceAlphaImageMeshLayer>,
	context: GraphicsBuildContext,
	logger: Logger,
): Promise<Immutable<(GraphicsMeshLayer | GraphicsAlphaImageMeshLayer)[]>> {
	const resultLayer = await LoadAssetImageLayerSingle(
		layer,
		context,
		logger.prefixMessages(`[Layer ${layer.name ?? '[unnamed]'}]`),
	);

	if (layer.mirror !== LayerMirror.NONE) {
		const resultMirror = await LoadAssetImageLayerSingle(
			produce(layer, (d) => {
				d.priority = MirrorPriority(d.priority);
				d.pointType = d.pointType?.map(MirrorBoneLike);
				d.image = MirrorLayerImageSetting(d.image);
				d.scaling = d.scaling && {
					...d.scaling,
					stops: d.scaling.stops.map((stop) => [stop[0], MirrorLayerImageSetting(stop[1])]),
				};
			}),
			context,
			logger.prefixMessages(`[Mirrored layer ${layer.name ?? '[unnamed]'}]`),
		);
		return [resultLayer, resultMirror];
	}

	return [resultLayer];
}
