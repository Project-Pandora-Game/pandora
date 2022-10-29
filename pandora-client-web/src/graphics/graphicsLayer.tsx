import { Container, SimpleMesh, Sprite, useApp } from '@saitonakamura/react-pixi';
import Delaunator from 'delaunator';
import { max, maxBy, min, minBy } from 'lodash';
import { BoneName, CharacterSize, CoordinatesCompressed, Item, LayerImageSetting, LayerMirror, PointDefinition } from 'pandora-common';
import * as PIXI from 'pixi.js';
import { IArrayBuffer, Mesh, Rectangle, Texture } from 'pixi.js';
import React, { ReactElement, useMemo } from 'react';
import { AssetGraphicsLayer, PointDefinitionCalculated } from '../assets/assetGraphics';
import { AppearanceContainer } from '../character/character';
import { ChildrenProps } from '../common/reactTypes';
import { AppearanceConditionEvaluator, useAppearanceConditionEvaluator } from './appearanceConditionEvaluator';
import { LayerStateOverrides } from './def';
import { useTexture } from './useTexture';
import { EvaluateCondition } from './utility';

Mesh.BATCHABLE_SIZE = 1000000;

export function useLayerPoints(layer: AssetGraphicsLayer): {
	points: readonly PointDefinitionCalculated[];
	triangles: Uint32Array;
} {
	// Note: The points should NOT be filtered before Delaunator step!
	// Doing so would cause body and arms not to have exactly matching triangles,
	// causing (most likely) overlap, which would result in clipping.
	// In some other cases this could lead to gaps or other visual artifacts
	// Any optimization of unused points needs to be done *after* triangles are calculated
	const points = useMemo(() => layer.calculatePoints(), [layer]);

	const pointType = layer.definition.pointType;
	const triangles = useMemo<Uint32Array>(() => {
		const result: number[] = [];
		const delaunator = new Delaunator(points.flatMap((point) => point.pos));
		for (let i = 0; i < delaunator.triangles.length; i += 3) {
			const t = [i, i + 1, i + 2].map((tp) => delaunator.triangles[tp]);
			if (t.every((tp) => SelectPoints(points[tp], pointType))) {
				result.push(...t);
			}
		}
		return new Uint32Array(result);
	}, [pointType, points]);
	return { points, triangles };
}

export function SelectPoints({ pointType }: PointDefinition, pointTypes?: string[]): boolean {
	// If point has no type, include it
	return !pointType ||
		// If there is no requirement on point types, include all
		!pointTypes ||
		// If the point type is included exactly, include it
		pointTypes.includes(pointType) ||
		// If the point type doesn't have side, include it if wanted types have sided one
		!pointType.match(/_[lr]$/) && (
			pointTypes.includes(pointType + '_r') ||
			pointTypes.includes(pointType + '_l')
		) ||
		// If the point type has side, indide it if wanted types have base one
		pointTypes.includes(pointType.replace(/_[lr]$/, ''));
}

export function MirrorPoint([x, y]: CoordinatesCompressed, mirror: LayerMirror, width: number): CoordinatesCompressed {
	if (mirror === LayerMirror.FULL)
		return [x - width, y];

	return [x, y];
}

export function useLayerVertices(
	evaluator: AppearanceConditionEvaluator,
	points: readonly PointDefinitionCalculated[],
	layer: AssetGraphicsLayer,
	item: Item | null,
	normalize: boolean = false,
	valueOverrides?: Record<BoneName, number>,
): Float64Array {
	const mirrorType = layer.definition.mirror;
	const height = layer.definition.height;
	const width = layer.definition.width;

	return useMemo(() => {
		const result = new Float64Array(points
			.flatMap((point) => evaluator.evalTransform(
				MirrorPoint(point.pos, mirrorType, width),
				point.transforms,
				point.mirror,
				item,
				valueOverrides,
			)));

		if (normalize) {
			for (let i = 0; i < result.length; i++) {
				result[i] /= i % 2 ? height : width;
			}
		}
		return result;
	}, [evaluator, mirrorType, height, width, item, normalize, points, valueOverrides]);
}

export interface GraphicsLayerProps extends ChildrenProps {
	appearanceContainer: AppearanceContainer;
	zIndex: number;
	lowerZIndex: number;
	layer: AssetGraphicsLayer,
	item: Item | null,
	verticesPoseOverride?: Record<BoneName, number>;
	state?: LayerStateOverrides;
	getTexture?: (path: string) => Promise<Texture>;
}

export function GraphicsLayer({
	appearanceContainer,
	children,
	zIndex,
	lowerZIndex,
	layer,
	item,
	verticesPoseOverride,
	state,
	getTexture,
}: GraphicsLayerProps): ReactElement {

	const { points, triangles } = useLayerPoints(layer);

	const evaluator = useAppearanceConditionEvaluator(appearanceContainer);

	const vertices = useLayerVertices(evaluator, points, layer, item, false, verticesPoseOverride);

	const scalingBaseimage = layer.definition.image;
	const scaling = layer.definition.scaling;
	const uvPose = useMemo<Record<BoneName, number>>(() => {
		if (scaling) {
			let settingValue: number | undefined;
			const stops = scaling.stops.map((stop) => stop[0]);
			const value = evaluator.getBoneLikeValue(scaling.scaleBone);
			// Find the best matching scaling override
			if (value > 0) {
				settingValue = max(stops.filter((stop) => stop > 0 && stop <= value));
			} else if (value < 0) {
				settingValue = min(stops.filter((stop) => stop < 0 && stop >= value));
			}
			if (settingValue) {
				return { [scaling.scaleBone]: settingValue };
			}
		}
		return {};
	}, [evaluator, scaling]);
	const uv = useLayerVertices(evaluator, points, layer, item, true, uvPose);

	const setting = useMemo<LayerImageSetting>(() => {
		if (scaling) {
			const value = evaluator.getBoneLikeValue(scaling.scaleBone);
			// Find the best matching scaling override
			if (value > 0) {
				return maxBy(scaling.stops.filter((stop) => stop[0] > 0 && stop[0] <= value), (stop) => stop[0])?.[1] ?? scalingBaseimage;
			} else if (value < 0) {
				return minBy(scaling.stops.filter((stop) => stop[0] < 0 && stop[0] >= value), (stop) => stop[0])?.[1] ?? scalingBaseimage;
			}
		}
		return scalingBaseimage;
	}, [evaluator, scaling, scalingBaseimage]);

	const image = useMemo<string>(() => {
		return setting.overrides.find((img) => EvaluateCondition(img.condition, (c) => evaluator.evalCondition(c, item)))?.image ?? setting.image;
	}, [evaluator, item, setting]);

	const alphaImage = useMemo<string>(() => {
		return setting.alphaOverrides?.find((img) => EvaluateCondition(img.condition, (c) => evaluator.evalCondition(c, item)))?.image ?? setting.alphaImage ?? '';
	}, [evaluator, item, setting]);
	const alphaMesh = useMemo(() => ({
		vertices,
		uvs: uv,
		indices: triangles,
	}), [vertices, uv, triangles]);

	const texture = useTexture(image, undefined, getTexture);

	const colorizationIndex = layer.definition.colorizationIndex;
	const color: number = state?.color ??
		(
			(
				item != null &&
				colorizationIndex != null &&
				colorizationIndex >= 0 &&
				colorizationIndex < item.color.length
			) ? Number.parseInt(item.color[colorizationIndex].slice(1), 16) : undefined
		) ??
		0xffffff;

	const alpha = state?.alpha ?? 1;

	return (
		<Container
			zIndex={ zIndex }
			sortableChildren
		>
			<SimpleMesh
				x={ layer.definition.x }
				y={ layer.definition.y }
				vertices={ vertices }
				uvs={ uv }
				indices={ triangles }
				texture={ texture }
				tint={ color }
				alpha={ alpha }
			/>
			<MaskContainer maskImage={ alphaImage } maskMesh={ alphaMesh } zIndex={ lowerZIndex }>
				{ children }
			</MaskContainer>
		</Container>
	);
}

function MaskContainer({
	children,
	maskImage,
	maskMesh,
	zIndex,
	getTexture,
}: ChildrenProps & {
	maskImage: string;
	maskMesh?: {
		vertices: IArrayBuffer;
		uvs: IArrayBuffer;
		indices: IArrayBuffer;
	}
	zIndex?: number;
	getTexture?: (path: string) => Promise<Texture>;
}): ReactElement {
	const app = useApp();
	const alphaTexture = useTexture(maskImage, true, getTexture);

	const finalAlphaTexture = useMemo(() => {
		if (!maskImage)
			return Texture.WHITE;
		// Create base for the mask
		const maskContainer = new PIXI.Container();
		const background = new PIXI.Sprite(Texture.WHITE);
		background.width = CharacterSize.WIDTH;
		background.height = CharacterSize.HEIGHT;
		maskContainer.addChild(background);
		if (maskMesh) {
			maskContainer.addChild(new PIXI.SimpleMesh(alphaTexture, maskMesh.vertices, maskMesh.uvs, maskMesh.indices));
		} else {
			maskContainer.addChild(new PIXI.Sprite(alphaTexture));
		}

		// Render mask texture
		const bounds = new Rectangle(0, 0, CharacterSize.WIDTH, CharacterSize.HEIGHT);
		return app.renderer.generateTexture(maskContainer, {
			resolution: 1,
			region: bounds,
			scaleMode: PIXI.SCALE_MODES.NEAREST,
			multisample: PIXI.MSAA_QUALITY.NONE,
		});
	}, [maskImage, maskMesh, alphaTexture, app]);

	const [mask, setMask] = React.useState<PIXI.Sprite | null>(null);

	return (
		<>
			<Container mask={ mask } zIndex={ zIndex }>
				{ children }
			</Container>
			{
				!maskImage ? null :
				<Sprite ref={ setMask } texture={ finalAlphaTexture } />
			}
		</>
	);
}
