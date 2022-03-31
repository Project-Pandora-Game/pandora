import type { LayerDefinition, AssetId, AtomicCondition, TransformDefinition } from 'pandora-common/dist/character/asset/definition';
import type { LayerStateCompressed } from 'pandora-common/dist/character/asset/state';

export interface BoneState {
	name: string;
	x: number;
	y: number;
	get rotation(): number;
	updateRotation(value: number): boolean;
	parent?: BoneState;
	mirror?: BoneState;
}

export type BoneDefinitionBase = {
	name: string;
	mirror?: BoneDefinitionBase;
};

export type LayerState<LayerDefinitionType = LayerDefinition> = {
	asset: AssetDefinition<LayerDefinitionType>;
	layer: LayerDefinitionType,
	state?: LayerStateCompressed;
	index: number;
};

export type AssetDefinition<LayerDefinitionType = LayerDefinition> = {
	id: AssetId;
	layers: LayerDefinitionType[];
	description: string;
};

export type GraphicsEvaluate = (condition: AtomicCondition) => boolean;
export type GraphicsTransform = ([x, y]: [number, number], transforms: readonly TransformDefinition[], mirror: boolean) => [number, number];
