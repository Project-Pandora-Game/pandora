import type { AtomicCondition, TransformDefinition } from 'pandora-common';
import { AssetGraphics, AssetGraphicsLayer } from '../assets/assetGraphics';

export type LayerStateOverrides = {
	color?: number;
	alpha?: number;
};

export type LayerState = {
	asset: AssetGraphics;
	layer: AssetGraphicsLayer,
	state?: LayerStateOverrides;
	index: number;
};

export type GraphicsEvaluate = (condition: AtomicCondition) => boolean;
export type GraphicsTransform = ([x, y]: [number, number], transforms: readonly TransformDefinition[], mirror: boolean) => [number, number];
