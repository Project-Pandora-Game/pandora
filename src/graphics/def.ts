import type { LayerDefinition, AtomicCondition, TransformDefinition, LayerStateCompressed } from 'pandora-common/dist/assets';
import { AssetDefinitionClient } from '../assets/assetManager';

export interface BoneState {
	name: string;
	x: number;
	y: number;
	rotation: number;
	parent?: BoneState;
	mirror?: BoneState;
}

export type BoneDefinitionBase = {
	name: string;
	mirror?: BoneDefinitionBase;
};

export type LayerState = {
	asset: AssetDefinitionClient;
	layer: LayerDefinition,
	state?: LayerStateCompressed;
	index: number;
};

export type GraphicsEvaluate = (condition: AtomicCondition) => boolean;
export type GraphicsTransform = ([x, y]: [number, number], transforms: readonly TransformDefinition[], mirror: boolean) => [number, number];
